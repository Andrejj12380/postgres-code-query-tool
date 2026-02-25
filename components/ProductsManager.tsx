
import React, { useState } from 'react';
import { Product } from '../types';

interface ProductsManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const ProductsManager: React.FC<ProductsManagerProps> = ({ products, setProducts }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [gtin, setGtin] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGtin, setEditGtin] = useState('');
  const [editError, setEditError] = useState('');

  const handleSave = () => {
    setError('');

    // Validation
    const gtinRegex = /^046\d{11}$/;
    if (!gtinRegex.test(gtin)) {
      setError('GTIN обязателен и должен состоять из 14 цифр, начинаясь с 046');
      return;
    }

    const newProduct: Product = {
      id: crypto.randomUUID(),
      name: name.trim(),
      gtin
    };

    setProducts([...products, newProduct]);
    setIsAdding(false);
    setName('');
    setGtin('');
  };

  const deleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name || '');
    setEditGtin(product.gtin);
    setEditError('');
    setIsAdding(false);
  };

  const handleEditSave = () => {
    if (!editingId) return;
    setEditError('');

    const gtinRegex = /^046\d{11}$/;
    if (!gtinRegex.test(editGtin)) {
      setEditError('GTIN обязателен и должен состоять из 14 цифр, начинаясь с 046');
      return;
    }

    setProducts(products.map(p => {
      if (p.id !== editingId) return p;
      return {
        ...p,
        name: editName.trim(),
        gtin: editGtin
      };
    }));

    setEditingId(null);
    setEditName('');
    setEditGtin('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditGtin('');
    setEditError('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Список продукции</h2>
        <button
          onClick={() => setIsAdding(true)}
          data-tour="products-add-btn"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Добавить продукт
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Данные продукта</h3>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Наименование (необязательно)</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Например: Молоко 3.2% 1л"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GTIN (14 цифр, старт с 046)</label>
              <input
                type="text"
                maxLength={14}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="04601234567890"
                value={gtin}
                onChange={e => setGtin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">Сохранить</button>
            <button onClick={() => setIsAdding(false)} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300">Отмена</button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-amber-200">
          <h3 className="text-lg font-semibold mb-4">Редактировать продукт</h3>
          {editError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{editError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Наименование (необязательно)</label>
              <input
                type="text"
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Например: Молоко 3.2% 1л"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GTIN (14 цифр, старт с 046)</label>
              <input
                type="text"
                maxLength={14}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="04601234567890"
                value={editGtin}
                onChange={e => setEditGtin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={handleEditSave} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-700">Обновить</button>
            <button onClick={cancelEditing} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300">Отмена</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {product.name ? (
                    <>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-1">{product.gtin}</div>
                    </>
                  ) : (
                    <div className="font-medium text-gray-900">{product.gtin}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="inline-flex gap-3">
                    <button onClick={() => startEditing(product)} className="text-blue-600 hover:text-blue-800">Редактировать</button>
                    <button onClick={() => deleteProduct(product.id)} className="text-red-600 hover:text-red-900">Удалить</button>
                  </div>
                </td>
              </tr>
            ))}            {products.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-gray-500 italic">Список пуст</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsManager;
