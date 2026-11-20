import React, { useState, useEffect, useMemo } from 'react';
import { ALL_CODE_FIELDS, CodeField } from '../types';

interface FieldLabelsEditorProps {
    fieldLabels: Record<string, string>;
    extraFields?: CodeField[];
    onSave: (labels: Record<string, string>) => void;
}

const FieldLabelsEditor: React.FC<FieldLabelsEditorProps> = ({ fieldLabels, extraFields = [], onSave }) => {
    const [labels, setLabels] = useState<Record<string, string>>(fieldLabels || {});
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        setLabels(fieldLabels || {});
    }, [fieldLabels]);

    const allFields = useMemo(() => {
        const map = new Map<string, CodeField>();
        ALL_CODE_FIELDS.forEach(f => map.set(f.key, f));
        extraFields.forEach(f => {
            if (!map.has(f.key)) {
                map.set(f.key, { ...f, isCustom: true });
            }
        });
        Object.keys(fieldLabels || {}).forEach(key => {
            if (!map.has(key)) {
                map.set(key, { key, label: key, isCustom: true });
            }
        });
        return Array.from(map.values());
    }, [extraFields, fieldLabels]);

    const handleChange = (key: string, value: string) => {
        setLabels(prev => ({ ...prev, [key]: value }));
        setShowSuccess(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(labels);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-slideUp" data-tour="field-labels-editor">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Настройка названий полей</h3>
                <div className="flex items-center gap-3">
                    {showSuccess && (
                        <span className="text-green-600 text-sm font-medium animate-fadeIn">✓ Сохранено</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 gap-4">
                    {allFields.map(field => (
                        <div key={field.key} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                            <div className="md:w-1/3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Поле в БД:</span>
                                    {field.isCustom && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">Из БД</span>
                                    )}
                                </div>
                                <p className="font-mono text-sm text-gray-600">{field.key}</p>
                                <p className="text-xs text-gray-400 italic">По умолчанию: {field.label}</p>
                            </div>
                            <div className="flex-1">
                                <span className="text-xs font-bold text-gray-400 uppercase">Ваше название:</span>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    placeholder={field.label}
                                    value={labels[field.key] || ''}
                                    onChange={e => handleChange(field.key, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FieldLabelsEditor;
