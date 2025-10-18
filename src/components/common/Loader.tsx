export const Loader = ({ label = 'Загрузка...' }: { label?: string }) => (
  <div className="empty-state">
    <strong>{label}</strong>
    <span>Пожалуйста, подождите</span>
  </div>
);
