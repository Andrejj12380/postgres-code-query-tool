
import React, { useState } from 'react';
import { DbConnection } from '../types';

interface ConnectionsManagerProps {
  connections: DbConnection[];
  setConnections: React.Dispatch<React.SetStateAction<DbConnection[]>>;
}

const ConnectionsManager: React.FC<ConnectionsManagerProps> = ({ connections, setConnections }) => {
  const [isAdding, setIsAdding] = useState(false);
  const createDefaultForm = () => ({
    name: '',
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: '',
    password: ''
  });

  const [formData, setFormData] = useState<Partial<DbConnection>>(createDefaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<DbConnection>>(createDefaultForm);

  const resetAddForm = () => setFormData(createDefaultForm());
  const resetEditing = () => {
    setEditingId(null);
    setEditingData(createDefaultForm());
  };

  const handleSave = () => {
    if (!formData.name || !formData.host || !formData.database) return;

    const newConnection: DbConnection = {
      id: crypto.randomUUID(),
      name: formData.name || '',
      host: formData.host || '',
      port: Number(formData.port) || 5432,
      user: formData.user || '',
      database: formData.database || '',
      password: formData.password || ''
    };

    setConnections([...connections, newConnection]);
    setIsAdding(false);
    resetAddForm();
  };

  const startEditing = (conn: DbConnection) => {
    setEditingId(conn.id);
    setEditingData({ ...conn });
    setIsAdding(false);
  };

  const handleEditSave = () => {
    if (!editingId || !editingData.name || !editingData.host || !editingData.database) return;

    setConnections(connections.map(conn => {
      if (conn.id !== editingId) return conn;
      return {
        ...conn,
        name: editingData.name || conn.name,
        host: editingData.host || conn.host,
        port: Number(editingData.port) || conn.port,
        user: editingData.user || '',
        database: editingData.database || conn.database,
        password: editingData.password || ''
      };
    }));

    resetEditing();
  };

  const deleteConnection = (id: string) => {
    setConnections(connections.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Подключения к базе данных</h2>
        <button
          onClick={() => setIsAdding(true)}
          data-tour="connections-add-btn"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Новое подключение
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Добавить настройки</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Название (для списка)</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IP адрес / Хост</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Порт</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Название БД</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.database}
                onChange={e => setFormData({ ...formData, database: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Логин</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.user}
                onChange={e => setFormData({ ...formData, user: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Пароль</label>
              <input
                type="password"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700"
            >
              Сохранить
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-amber-200">
          <h3 className="text-lg font-semibold mb-4">Редактировать подключение</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Название (для списка)</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.name || ''}
                onChange={e => setEditingData({ ...editingData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IP адрес / Хост</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.host || ''}
                onChange={e => setEditingData({ ...editingData, host: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Порт</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.port ?? 5432}
                onChange={e => setEditingData({ ...editingData, port: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Название БД</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.database || ''}
                onChange={e => setEditingData({ ...editingData, database: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Логин</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.user || ''}
                onChange={e => setEditingData({ ...editingData, user: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Пароль</label>
              <input
                type="password"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                value={editingData.password || ''}
                onChange={e => setEditingData({ ...editingData, password: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button
              onClick={handleEditSave}
              className="bg-amber-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-700"
            >
              Обновить
            </button>
            <button
              onClick={resetEditing}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connections.map(conn => (
          <div key={conn.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative group">
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEditing(conn)}
                className="text-blue-500 p-2 hover:bg-blue-50 rounded-full"
                title="Редактировать"
              >
                ✏️
              </button>
              <button
                onClick={() => deleteConnection(conn.id)}
                className="text-red-500 p-2 hover:bg-red-50 rounded-full"
                title="Удалить"
              >
                🗑️
              </button>
            </div>
            <h4 className="text-xl font-bold text-gray-800">{conn.name}</h4>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold">Host:</span> {conn.host}:{conn.port}</p>
              <p><span className="font-semibold">DB:</span> {conn.database}</p>
              <p><span className="font-semibold">User:</span> {conn.user}</p>
            </div>
          </div>
        ))}
        {connections.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-500">Нет сохраненных подключений</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionsManager;
