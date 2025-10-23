import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ORDER_PRICING = {
  channel: 1.8,
  group: 1.3
};

const TASK_REWARD = {
  channel: 1.2,
  group: 0.8
};

const REFERRAL_PERCENTAGE = 0.1;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.resolve(__dirname, '../dist');
const staticIndexPath = path.join(staticDir, 'index.html');
const hasStaticBundle = fs.existsSync(staticIndexPath);

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL || process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.error('[server] Переменная DATABASE_URL не задана.');
  throw new Error('DATABASE_URL не настроен. Укажите строку подключения к Railway PostgreSQL.');
}

const useSSL = !/localhost|127\.0\.0\.1/.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined
});

pool.on('error', error => {
  console.error('[server] Неожиданная ошибка подключения к PostgreSQL', error);
});

const telegramToken = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const telegramApiBase = telegramToken ? `https://api.telegram.org/bot${telegramToken}` : '';

class TelegramError extends Error {
  constructor(message, payload) {
    super(message);
    this.name = 'TelegramError';
    this.payload = payload;
  }
}

const telegramRequest = async (method, params) => {
  if (!telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN не настроен.');
  }

  const response = await fetch(`${telegramApiBase}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const payload = await response.json();
  if (!payload.ok) {
    throw new TelegramError(payload.description || 'Ошибка Telegram API', payload);
  }

  return payload.result;
};

let botIdentity = null;

const ensureBotIdentity = async () => {
  if (botIdentity || !telegramToken) {
    return botIdentity;
  }

  botIdentity = await telegramRequest('getMe');
  return botIdentity;
};

const parseChatIdentifier = link => {
  if (!link) {
    throw new Error('Укажите ссылку на канал или группу');
  }

  const trimmed = link.trim();
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  let candidate = trimmed;
  if (!/^https?:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch (error) {
    throw new Error('Неверный формат ссылки. Используйте адрес вида https://t.me/username');
  }

  if (!url.hostname.endsWith('t.me') && !url.hostname.endsWith('telegram.me')) {
    throw new Error('Поддерживаются только публичные ссылки Telegram (t.me)');
  }

  const path = url.pathname.replace(/^\//, '');
  if (!path) {
    throw new Error('Неверная ссылка на канал или группу');
  }

  const [identifier] = path.split('/');
  if (identifier.startsWith('+')) {
    throw new Error('Используйте публичную ссылку на канал или группу');
  }

  return identifier.startsWith('@') ? identifier : `@${identifier}`;
};

const normalizeOrderLink = link => {
  const identifier = parseChatIdentifier(link);
  return `https://t.me/${identifier.replace(/^@/, '')}`;
};

const isAdministrator = status => status === 'administrator' || status === 'creator';
const isMemberStatus = status => isAdministrator(status) || status === 'member';

const ensureBotHasAccess = async chatIdentifier => {
  try {
    const bot = await ensureBotIdentity();
    const member = await telegramRequest('getChatMember', {
      chat_id: chatIdentifier,
      user_id: bot.id
    });

    if (!isAdministrator(member.status)) {
      throw new Error('Бот должен быть администратором выбранного канала или группы');
    }
  } catch (error) {
    if (error instanceof TelegramError) {
      const description = error.payload?.description || error.message;
      throw new Error(`Не удалось проверить права бота: ${description}`);
    }
    throw error;
  }
};

const ensureUserIsMember = async (chatIdentifier, telegramId) => {
  try {
    const member = await telegramRequest('getChatMember', {
      chat_id: chatIdentifier,
      user_id: telegramId
    });

    return isMemberStatus(member.status);
  } catch (error) {
    if (error instanceof TelegramError) {
      if (error.payload?.error_code === 400) {
        return false;
      }
      const description = error.payload?.description || error.message;
      throw new Error(`Не удалось проверить подписку: ${description}`);
    }
    throw error;
  }
};

const ensureSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      telegram_id BIGINT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_telegram_id_idx ON user_profiles (telegram_id)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      chat_identifier TEXT NOT NULL,
      link TEXT NOT NULL,
      data JSONB NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_completions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const referrerSchema = z
  .object({
    id: z.string(),
    fullName: z.string(),
    commissionRate: z.number()
  })
  .optional();

const userProfileSchema = z.object({
  id: z.string(),
  telegramId: z.number().optional(),
  firstName: z.string(),
  lastName: z.string().optional(),
  fullName: z.string(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  balance: z.number(),
  lifetimeEarned: z.number(),
  lifetimeSpent: z.number(),
  ordersPlaced: z.number(),
  tasksCompleted: z.number(),
  totalTopUps: z.number(),
  totalTopUpAmount: z.number(),
  referralsCount: z.number(),
  referralEarnings: z.number(),
  referralCode: z.string(),
  createdAt: z.string(),
  passwordHash: z.string(),
  referrer: referrerSchema
});

const createOrderSchema = z.object({
  userId: z.string(),
  payload: z.object({
    type: z.enum(['channel', 'group']),
    requestedCount: z.number().int().min(10),
    link: z.string()
  })
});

const completeTaskSchema = z.object({
  userId: z.string(),
  telegramId: z.number().int().optional()
});

const activitySchema = z.object({
  userId: z.string(),
  event: z.object({
    id: z.string(),
    type: z.enum(['topup', 'spend', 'earn', 'referral']),
    amount: z.number(),
    description: z.string(),
    createdAt: z.string()
  })
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/users/sync', async (req, res, next) => {
  try {
    const { profile } = req.body ?? {};
    const parsed = userProfileSchema.parse(profile);

    await pool.query(
      `
      INSERT INTO user_profiles (id, telegram_id, data, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        telegram_id = EXCLUDED.telegram_id,
        data = EXCLUDED.data,
        updated_at = NOW()
    `,
      [parsed.id, parsed.telegramId ?? null, parsed]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT data FROM user_profiles WHERE id = $1', [id]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Профиль пользователя не найден' });
      return;
    }

    res.json({ profile: result.rows[0].data });
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT data FROM orders ORDER BY created_at DESC');
    const orders = result.rows.map(row => row.data);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const payload = createOrderSchema.parse(req.body);
    const { userId } = payload;

    const userResult = await pool.query('SELECT data FROM user_profiles WHERE id = $1', [userId]);
    if (!userResult.rowCount) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const user = userResult.rows[0].data;
    const identifier = parseChatIdentifier(payload.payload.link);

    let botIsAdmin = false;
    if (!telegramToken) {
      console.warn(
        '[orders] TELEGRAM_BOT_TOKEN не задан. Проверка прав бота будет пропущена, заказ помечен как требующий проверки.'
      );
    } else {
      try {
        await ensureBotHasAccess(identifier);
        botIsAdmin = true;
      } catch (error) {
        console.error('[orders] Не удалось подтвердить права бота:', error);
      }
    }

    const type = payload.payload.type;
    const requestedCount = Math.max(10, payload.payload.requestedCount);
    const pricePerUnit = ORDER_PRICING[type];
    const totalBudget = requestedCount * pricePerUnit;

    if (user.balance < totalBudget) {
      res.status(400).json({ error: 'Недостаточно средств на балансе' });
      return;
    }

    const orderId = randomUUID();
    const createdAt = new Date().toISOString();
    const normalizedLink = normalizeOrderLink(payload.payload.link);

    const updatedUser = {
      ...user,
      balance: Math.max(0, user.balance - totalBudget),
      lifetimeSpent: (user.lifetimeSpent ?? 0) + totalBudget,
      ordersPlaced: (user.ordersPlaced ?? 0) + 1,
      referralEarnings:
        user.referrer && typeof user.referrer.commissionRate === 'number'
          ? (user.referralEarnings ?? 0) + totalBudget * user.referrer.commissionRate
          : user.referralEarnings ?? 0
    };

    const order = {
      id: orderId,
      ownerId: userId,
      ownerName: user.fullName,
      ownerUsername: user.username,
      ownerAvatar: user.avatarUrl,
      type,
      link: normalizedLink,
      requestedCount,
      completedCount: 0,
      pricePerUnit,
      totalBudget,
      status: 'active',
      createdAt,
      botIsAdmin
    };

    await pool.query('UPDATE user_profiles SET data = $2, telegram_id = $3, updated_at = NOW() WHERE id = $1', [
      userId,
      updatedUser,
      updatedUser.telegramId ?? null
    ]);

    await pool.query(
      `INSERT INTO orders (id, owner_id, chat_identifier, link, data, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [orderId, userId, identifier, normalizedLink, order, order.status, createdAt]
    );

    res.status(201).json({ order, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/complete', async (req, res, next) => {
  try {
    if (!telegramToken) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен. Невозможно проверить подписку пользователя.');
    }

    const { id } = req.params;
    const { userId, telegramId } = completeTaskSchema.parse(req.body);

    if (typeof telegramId !== 'number') {
      res.status(400).json({ error: 'Для проверки подписки требуется привязанный Telegram аккаунт' });
      return;
    }

    const orderResult = await pool.query('SELECT data, chat_identifier FROM orders WHERE id = $1', [id]);
    if (!orderResult.rowCount) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    const order = orderResult.rows[0].data;
    const chatIdentifier = orderResult.rows[0].chat_identifier;

    if (order.ownerId === userId) {
      res.status(400).json({ error: 'Нельзя выполнять собственные задания' });
      return;
    }

    if (order.status === 'completed') {
      res.status(400).json({ error: 'Задание уже завершено' });
      return;
    }

    const completionCheck = await pool.query('SELECT id FROM task_completions WHERE order_id = $1 AND user_id = $2', [id, userId]);
    if (completionCheck.rowCount) {
      res.status(400).json({ error: 'Вы уже выполнили это задание' });
      return;
    }

    const isMember = await ensureUserIsMember(chatIdentifier, telegramId);
    if (!isMember) {
      res.status(403).json({ error: 'Бот не подтвердил подписку на канал или группу' });
      return;
    }

    const userResult = await pool.query('SELECT data FROM user_profiles WHERE id = $1', [userId]);
    if (!userResult.rowCount) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const user = userResult.rows[0].data;
    const reward = TASK_REWARD[order.type];
    const referralCommission = user.referrer
      ? reward * (typeof user.referrer.commissionRate === 'number' ? user.referrer.commissionRate : REFERRAL_PERCENTAGE)
      : 0;

    const updatedUser = {
      ...user,
      balance: (user.balance ?? 0) + reward,
      lifetimeEarned: (user.lifetimeEarned ?? 0) + reward,
      tasksCompleted: (user.tasksCompleted ?? 0) + 1
    };

    const updatedOrder = {
      ...order,
      completedCount: order.completedCount + 1,
      status: order.completedCount + 1 >= order.requestedCount ? 'completed' : 'active'
    };

    const completedAt = new Date().toISOString();

    await pool.query('UPDATE user_profiles SET data = $2, telegram_id = $3, updated_at = NOW() WHERE id = $1', [
      userId,
      updatedUser,
      updatedUser.telegramId ?? null
    ]);

    await pool.query('UPDATE orders SET data = $2, status = $3, updated_at = NOW() WHERE id = $1', [
      id,
      updatedOrder,
      updatedOrder.status
    ]);

    await pool.query('INSERT INTO task_completions (id, order_id, user_id, completed_at) VALUES ($1, $2, $3, $4)', [
      randomUUID(),
      id,
      userId,
      completedAt
    ]);

    res.json({ order: updatedOrder, user: updatedUser, reward, referralCommission, completedAt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/task-completions/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT order_id, completed_at FROM task_completions WHERE user_id = $1 ORDER BY completed_at DESC',
      [userId]
    );
    const completions = result.rows.map(row => ({ orderId: row.order_id, completedAt: row.completed_at }));
    res.json({ completions });
  } catch (error) {
    next(error);
  }
});

app.post('/api/activity', async (req, res, next) => {
  try {
    const payload = activitySchema.parse(req.body);
    const { userId, event } = payload;
    await pool.query(
      `INSERT INTO activity_log (id, user_id, type, amount, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, userId, event.type, event.amount, event.description, event.createdAt]
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/activity/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id, type, amount, description, created_at FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    const history = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      description: row.description,
      createdAt: row.created_at
    }));
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

if (hasStaticBundle) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    return res.sendFile(staticIndexPath);
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn(`[server] Статическая сборка не найдена. Ожидался файл: ${staticIndexPath}`);
}

app.use((error, _req, res, _next) => {
  console.error('[server] error:', error);
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Некорректные данные запроса' });
    return;
  }

  res.status(400).json({ error: error.message || 'Внутренняя ошибка сервера' });
});

const port = Number.parseInt(process.env.PORT ?? '8080', 10);

const verifyDatabaseConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[server] Подключение к базе данных установлено');
  } catch (error) {
    console.error('[server] Ошибка подключения к базе данных', error);
    throw error;
  }
};

const bootstrap = async () => {
  await verifyDatabaseConnection();
  await ensureSchema();
  if (telegramToken) {
    try {
      await ensureBotIdentity();
      console.log('[server] Telegram бот инициализирован');
    } catch (error) {
      console.error('[server] Не удалось инициализировать Telegram бота:', error);
    }
  } else {
    console.warn('[server] Переменная TELEGRAM_BOT_TOKEN не задана. Проверка подписок будет недоступна.');
  }

  app.listen(port, () => {
    console.log(`[server] API запущено на порту ${port}`);
  });
};

bootstrap().catch(error => {
  console.error('[server] Не удалось запустить API', error);
  process.exit(1);
});
