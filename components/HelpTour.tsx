import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ViewMode } from '../types';

interface TourStep {
    target: string | null; // data-tour attribute value, null = center modal (welcome)
    title: string;
    description: string;
    view: ViewMode | null; // which view to switch to before showing this step
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
    {
        target: null,
        title: '👋 Добро пожаловать!',
        description:
            'Это краткий интерактивный тур по приложению. Он покажет вам, как пользоваться каждой функцией. Нажмите «Далее», чтобы начать.',
        view: null,
        position: 'bottom',
    },
    {
        target: 'sidebar-nav',
        title: '📌 Боковое меню',
        description:
            'Здесь находятся все разделы приложения. Выберите нужный раздел одним кликом. Давайте начнём с настройки подключений к базам данных.',
        view: ViewMode.CONNECTIONS,
        position: 'right',
    },
    {
        target: 'connections-add-btn',
        title: '🔌 Базы данных',
        description:
            'Нажмите «+ Новое подключение», чтобы добавить PostgreSQL-базу. Укажите хост, порт, имя базы данных, логин и пароль. Подключения сохраняются автоматически.',
        view: ViewMode.CONNECTIONS,
        position: 'bottom',
    },
    {
        target: 'products-add-btn',
        title: '📦 Продукция (GTIN)',
        description:
            'Здесь добавляются товары по их коду GTIN (14 цифр, начиная с 046). Добавленный GTIN потом можно выбрать в фильтре на экране поиска.',
        view: ViewMode.PRODUCTS,
        position: 'bottom',
    },
    {
        target: 'field-labels-editor',
        title: '🏷️ Названия полей',
        description:
            'Вы можете переименовать стандартные поля базы данных. Например, «dtime_ins» → «Дата загрузки». Эти названия будут отображаться в интерфейсе и в заголовках Excel-файлов.',
        view: ViewMode.FIELD_NAMES,
        position: 'top',
    },
    {
        target: 'dashboard-db-select',
        title: '1️⃣ Выбор базы данных',
        description:
            'Выберите базу данных, к которой хотите сделать запрос. Список формируется из настроенных вами подключений.',
        view: ViewMode.DASHBOARD,
        position: 'bottom',
    },
    {
        target: 'dashboard-product-select',
        title: '2️⃣ Выбор продукции',
        description:
            'Выберите конкретный товар по GTIN или оставьте «Все наименования» для поиска по всей базе.',
        view: ViewMode.DASHBOARD,
        position: 'bottom',
    },
    {
        target: 'dashboard-date-field',
        title: '3️⃣ Поле даты',
        description:
            '«Production Date» — фильтрует по дате производства продукта. «Dtime Ins» — по дате записи кода в базу данных. Выберите нужное поле для вашей задачи.',
        view: ViewMode.DASHBOARD,
        position: 'bottom',
    },
    {
        target: 'dashboard-date-range',
        title: '4️⃣ Период поиска',
        description:
            'Выберите дату или включите тумблер «Диапазон» для поиска за несколько дней. Дату можно выбрать из календаря или ввести вручную в формате ГГГГ-ММ-ДД.',
        view: ViewMode.DASHBOARD,
        position: 'bottom',
    },
    {
        target: 'dashboard-status-select',
        title: '5️⃣ Фильтр по статусу',
        description:
            'Статус 1 — новые коды (ещё не выгружались). Статус 9 — уже выгруженные. Можно выбрать «Все статусы» или ввести произвольный статус.',
        view: ViewMode.DASHBOARD,
        position: 'bottom',
    },
    {
        target: 'dashboard-query-btn',
        title: '🔍 Запрос данных',
        description:
            'Нажмите эту кнопку, чтобы выполнить запрос к базе. Результаты появятся в таблице ниже — вы увидите количество кодов по каждому GTIN.',
        view: ViewMode.DASHBOARD,
        position: 'top',
    },
    {
        target: 'dashboard-columns',
        title: '☑️ Выбор полей для выгрузки',
        description:
            'Отметьте галочками, какие колонки нужно включить в файл при выгрузке. По умолчанию выбраны все поля.',
        view: ViewMode.DASHBOARD,
        position: 'top',
    },
    {
        target: 'dashboard-mark-exported',
        title: '🔖 Пометить выгруженные',
        description:
            'Если включить этот тумблер, при выгрузке статус всех выбранных записей автоматически изменится на 9 — чтобы не выгружать их повторно.',
        view: ViewMode.DASHBOARD,
        position: 'top',
    },
    {
        target: 'dashboard-export-btns',
        title: '📥 Кнопки выгрузки',
        description:
            '«Выгрузить детализацию (CSV / Excel)» — скачать полный список кодов с выбранными полями. «Скачать сводку» — краткая таблица с количеством кодов по каждому товару.',
        view: ViewMode.DASHBOARD,
        position: 'top',
    },
    {
        target: null,
        title: '🎉 Тур завершён!',
        description:
            'Теперь вы знаете, как пользоваться приложением. Если понадобится напоминание — нажмите «❓ Справка» в боковом меню.',
        view: null,
        position: 'bottom',
    },
];

interface HelpTourProps {
    isOpen: boolean;
    onClose: () => void;
    setActiveView: (view: ViewMode) => void;
}

interface HighlightBox {
    top: number;
    left: number;
    width: number;
    height: number;
}

const PADDING = 10;

const HelpTour: React.FC<HelpTourProps> = ({ isOpen, onClose, setActiveView }) => {
    const [stepIdx, setStepIdx] = useState(0);
    const [highlight, setHighlight] = useState<HighlightBox | null>(null);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const popupRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    const step = TOUR_STEPS[stepIdx];
    const isLast = stepIdx === TOUR_STEPS.length - 1;
    const isFirst = stepIdx === 0;

    const computeLayout = useCallback(() => {
        if (!step.target) {
            setHighlight(null);
            setPopupStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
            });
            return;
        }

        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (!el) {
            setHighlight(null);
            setPopupStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
            });
            return;
        }

        const rect = el.getBoundingClientRect();
        const box: HighlightBox = {
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
        };
        setHighlight(box);

        // position popup
        const pop = popupRef.current;
        const popW = pop ? pop.offsetWidth : 380;
        const popH = pop ? pop.offsetHeight : 220;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pos = step.position ?? 'bottom';

        let top = 0, left = 0;

        if (pos === 'bottom') {
            top = box.top + box.height + 12;
            left = box.left + box.width / 2 - popW / 2;
        } else if (pos === 'top') {
            top = box.top - popH - 12;
            left = box.left + box.width / 2 - popW / 2;
        } else if (pos === 'right') {
            top = box.top + box.height / 2 - popH / 2;
            left = box.left + box.width + 12;
        } else {
            top = box.top + box.height / 2 - popH / 2;
            left = box.left - popW - 12;
        }

        // clamp
        left = Math.max(12, Math.min(left, vw - popW - 12));
        top = Math.max(12, Math.min(top, vh - popH - 12));

        setPopupStyle({
            position: 'fixed',
            top,
            left,
            zIndex: 10001,
        });
    }, [step]);

    // Switch view and then compute layout
    useEffect(() => {
        if (!isOpen) return;

        if (step.view) {
            setActiveView(step.view);
        }

        // Wait for render after view switch
        const t = window.setTimeout(() => {
            if (step.target) {
                const el = document.querySelector(`[data-tour="${step.target}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            computeLayout();
        }, 120);

        return () => window.clearTimeout(t);
    }, [isOpen, stepIdx, computeLayout, step, setActiveView]);

    useEffect(() => {
        if (!isOpen) return;
        const onResize = () => computeLayout();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isOpen, computeLayout]);

    useEffect(() => {
        if (!isOpen) {
            setStepIdx(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (isLast) { onClose(); return; }
        setStepIdx(i => i + 1);
    };

    const handlePrev = () => {
        if (isFirst) return;
        setStepIdx(i => i - 1);
    };

    // SVG overlay (darkens everything except the highlight)
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

    return (
        <>
            {/* Overlay */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                {highlight ? (
                    <svg
                        width={vw}
                        height={vh}
                        style={{ display: 'block', position: 'absolute', inset: 0 }}
                    >
                        <defs>
                            <mask id="tour-mask">
                                <rect x={0} y={0} width={vw} height={vh} fill="white" />
                                <rect
                                    x={highlight.left}
                                    y={highlight.top}
                                    width={highlight.width}
                                    height={highlight.height}
                                    rx={8}
                                    ry={8}
                                    fill="black"
                                />
                            </mask>
                        </defs>
                        <rect
                            x={0} y={0} width={vw} height={vh}
                            fill="rgba(15,23,42,0.68)"
                            mask="url(#tour-mask)"
                        />
                        {/* Highlight border glow */}
                        <rect
                            x={highlight.left}
                            y={highlight.top}
                            width={highlight.width}
                            height={highlight.height}
                            rx={8} ry={8}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            style={{ filter: 'drop-shadow(0 0 6px #60a5fa)' }}
                        />
                    </svg>
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(15,23,42,0.68)',
                    }} />
                )}
            </div>

            {/* Popup card */}
            <div
                ref={popupRef}
                style={{ ...popupStyle, width: 380 }}
                className="rounded-2xl shadow-2xl border border-blue-200 bg-white overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
                    <span className="text-white text-sm font-semibold tracking-wide">
                        Шаг {stepIdx + 1} из {TOUR_STEPS.length}
                    </span>
                    <button
                        onClick={onClose}
                        className="text-blue-200 hover:text-white transition-colors text-lg leading-none"
                        title="Закрыть тур"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-blue-100">
                    <div
                        className="h-1 bg-blue-500 transition-all duration-300"
                        style={{ width: `${((stepIdx + 1) / TOUR_STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                </div>

                {/* Footer */}
                <div className="px-5 pb-4 flex items-center justify-between gap-2">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Пропустить
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrev}
                            disabled={isFirst}
                            className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Назад
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-5 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow transition-colors"
                        >
                            {isLast ? 'Завершить ✓' : 'Далее →'}
                        </button>
                    </div>
                </div>

                {/* Step dots */}
                <div className="pb-3 flex justify-center gap-1.5">
                    {TOUR_STEPS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setStepIdx(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === stepIdx ? 'bg-blue-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default HelpTour;
