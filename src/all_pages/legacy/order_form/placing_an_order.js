import React, { useState, useEffect } from 'react';
import { evaluate } from 'mathjs';
import { useNavigate } from 'react-router-dom';
import './placing_an_order.scss';

// Популярная палитра цветов для корпусной мебели (Россия/СНГ, 2024-2025)
// Источники: Egger, Kronospan, Lamarty, Kastamonu и другие популярные поставщики
const FURNITURE_COLORS = [
  { id: 'sonoma', name: 'Дуб Сонома', image: 'https://picsum.photos/id/201/300/200' },
  { id: 'venge', name: 'Венге', image: 'https://picsum.photos/id/160/300/200' },
  { id: 'natural-oak', name: 'Дуб Натуральный', image: 'https://picsum.photos/id/251/300/200' },
  { id: 'milk-oak', name: 'Дуб Молочный', image: 'https://picsum.photos/id/106/300/200' },
  { id: 'white', name: 'Белый', image: 'https://picsum.photos/id/29/300/200' },
  { id: 'gray', name: 'Серый', image: 'https://picsum.photos/id/201/300/200' },
  { id: 'shimo-ash', name: 'Ясень Шимо', image: 'https://picsum.photos/id/180/300/200' },
  { id: 'bardolino', name: 'Дуб Бардолино', image: 'https://picsum.photos/id/251/300/200' },
  { id: 'delano', name: 'Дуб Делано', image: 'https://picsum.photos/id/106/300/200' },
  { id: 'graphite', name: 'Графит', image: 'https://picsum.photos/id/160/300/200' },
  { id: 'wenge-magic', name: 'Венге Магия', image: 'https://picsum.photos/id/201/300/200' },
  { id: 'beech', name: 'Бук', image: 'https://picsum.photos/id/251/300/200' },
];

const PlacingAnOrder = () => {
    const navigate = useNavigate();

    const [order, setOrder] = useState({
        name_client: '',
        name_compony: '',
        address: '',
        phone: '',
        email: '',
        order_color: '',
        order_note: '',
        description_for_order: '',
        positions: []
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState('catalog'); // 'catalog' | 'custom'
    const [editingItemId, setEditingItemId] = useState(null); // ID редактируемой позиции

    // Защита от повторных нажатий
    const [isSaving, setIsSaving] = useState(false);

    // Для отслеживания изменений и автосохранения
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    // Простая система подтверждения (замена confirm)
    const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }

    // Простая система уведомлений (замена alert)
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

    // Скидка на весь заказ (в процентах)
    const [discountPercent, setDiscountPercent] = useState(0);

    // Для каталога
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputs, setInputs] = useState({});
    const [customDesc, setCustomDesc] = useState('');

    // Выбор цвета для мебели (новая функциональность)
    const [colorSelection, setColorSelection] = useState({
        mode: 'unified', // 'unified' | 'separate'
        unified: { name: '', image: '' },
        body: { name: '', image: '' },
        facade: { name: '', image: '' }
    });

    // Для произвольной позиции
    const [customItem, setCustomItem] = useState({
        title: '',
        price: '',
        quantity: 1,
        description: ''
    });

    const DRAFT_KEY = 'order_draft';

    // Загрузка черновика из localStorage при монтировании
    useEffect(() => {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                setOrder(parsed);
                setLastSaved(new Date());
            } catch (e) {
                console.warn('Не удалось загрузить черновик заказа');
            }
        }
    }, []);

    // Автосохранение черновика при изменении заказа
    useEffect(() => {
        if (order.positions.length > 0 || order.name_client || order.name_compony) {
            const timeout = setTimeout(() => {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(order));
                setLastSaved(new Date());
                setIsDirty(true);
            }, 800);

            return () => clearTimeout(timeout);
        }
    }, [order]);

    // Предупреждение при уходе со страницы
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty && order.positions.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, order.positions.length]);

    // Загрузка каталога
    useEffect(() => {
        fetch('http://localhost:8080/product')
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : [data]))
            .catch(err => console.error('Ошибка каталога:', err));
    }, []);

    // Инициализация при выборе товара или при редактировании
    useEffect(() => {
        if (!selectedProduct) return;
        const init = {};
        (selectedProduct.variables || []).forEach(v => init[v.name] = v.default);
        (selectedProduct.conditions || []).forEach(c => {
            if (c.type === 'flag') init[c.name] = !!c.default;
        });
        setInputs(init);
        setCustomDesc('');

        // Сброс выбора цвета при смене товара
        setColorSelection({
            mode: 'unified',
            unified: { name: '', image: '' },
            body: { name: '', image: '' },
            facade: { name: '', image: '' }
        });
    }, [selectedProduct]);

    const calculateDetails = (product, userInputs) => {
        if (!product?.details) return [];

        const nums = { ...userInputs };
        (product.variables || []).forEach(v => nums[v.name] = Number(nums[v.name]) || v.default || 0);
        (product.conditions || []).forEach(c => {
            if (c.type === 'flag') nums[c.name] = !!nums[c.name];
        });

        return product.details.map(detail => {
            if (detail.if_condition && !nums[detail.if_condition]) return null;
            try {
                const w = evaluate(detail.formula_width || '0', nums);
                const h = detail.formula_height ? evaluate(detail.formula_height, nums) : null;
                const cnt = evaluate(detail.count_formula || '1', nums);

                const size = h ? `${Math.round(w)} × ${Math.round(h)} мм` : `${Math.round(w)} мм`;
                return { key: detail.key, label: detail.label, size, count: Math.max(0, Math.round(cnt)) };
            } catch {
                return { key: detail.key, label: detail.label, size: 'Ошибка расчёта', count: 0 };
            }
        }).filter(Boolean);
    };

    // Открытие модалки для добавления / редактирования
    const openModal = (type, itemToEdit = null) => {
        setModalType(type);
        setModalOpen(true);

        if (itemToEdit) {
            setEditingItemId(itemToEdit.id);

            if (type === 'custom') {
                setCustomItem({
                    title: itemToEdit.title,
                    price: itemToEdit.price,
                    quantity: itemToEdit.quantity,
                    description: itemToEdit.description || ''
                });
            } else {
                // Для товаров из каталога
                setSelectedProduct(products.find(p => p.id === itemToEdit.productId) || null);
                setInputs({ ...itemToEdit.userInputs });
                setCustomDesc(itemToEdit.description || '');

                // Загружаем данные по цвету, если они есть
                if (itemToEdit.colorSelection) {
                    setColorSelection(itemToEdit.colorSelection);
                }
            }
        } else {
            setEditingItemId(null);
            setSelectedProduct(null);
            setInputs({});
            setCustomDesc('');
            setCustomItem({ title: '', price: '', quantity: 1, description: '' });
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingItemId(null);
        setSelectedProduct(null);
        setInputs({});
        setCustomDesc('');
        setCustomItem({ title: '', price: '', quantity: 1, description: '' });
        setColorSelection({
            mode: 'unified',
            unified: { name: '', image: '' },
            body: { name: '', image: '' },
            facade: { name: '', image: '' }
        });
    };

    // Добавление / Обновление позиции
    const savePosition = () => {
        if (modalType === 'catalog') {
            if (!selectedProduct) return;

            const calcDetails = calculateDetails(selectedProduct, inputs);
            const quantity = Number(inputs.coll) || 1;
            const price = Number(selectedProduct.price || 0);

            const newItem = {
                id: editingItemId || Date.now(),
                isCustom: false,
                productId: selectedProduct.id,
                title: selectedProduct.title,
                img: selectedProduct.img,
                description: customDesc,
                price,
                quantity,
                totalPrice: price * quantity,
                userInputs: { ...inputs },
                calculatedDetails: calcDetails,
                variables: selectedProduct.variables,
                conditions: selectedProduct.conditions,
                details: selectedProduct.details,
                // Новые данные по цвету
                colorSelection: { ...colorSelection }
            };

            setOrder(prev => ({
                ...prev,
                positions: editingItemId
                    ? prev.positions.map(item => item.id === editingItemId ? newItem : item)
                    : [...prev.positions, newItem]
            }));
        }
        else { // custom
            if (!customItem.title || !customItem.price) {
                showNotification('error', 'Укажите название и цену позиции');
                return;
            }

            const price = Number(customItem.price);
            const quantity = Number(customItem.quantity) || 1;

            const newItem = {
                id: editingItemId || Date.now(),
                isCustom: true,
                title: customItem.title.trim(),
                description: customItem.description,
                price,
                quantity,
                totalPrice: price * quantity,
                img: null
            };

            setOrder(prev => ({
                ...prev,
                positions: editingItemId
                    ? prev.positions.map(item => item.id === editingItemId ? newItem : item)
                    : [...prev.positions, newItem]
            }));
        }

        closeModal();
    };

    const removePosition = (id) => {
        setConfirmDialog({
            message: 'Удалить эту позицию?',
            onConfirm: () => {
                setOrder(prev => ({
                    ...prev,
                    positions: prev.positions.filter(item => item.id !== id)
                }));
                setIsDirty(true);
                setConfirmDialog(null);
            }
        });
    };

    const duplicatePosition = (item) => {
        const duplicated = {
            ...item,
            id: Date.now(),
            title: item.title + ' (копия)'
        };

        setOrder(prev => ({
            ...prev,
            positions: [...prev.positions, duplicated]
        }));
        setIsDirty(true);
    };

    // Очистка всей формы
    const clearForm = () => {
        setConfirmDialog({
            message: 'Очистить всю форму? Все несохранённые данные будут потеряны.',
            onConfirm: () => {
                const emptyOrder = {
                    name_client: '',
                    name_compony: '',
                    address: '',
                    phone: '',
                    email: '',
                    order_color: '',
                    order_note: '',
                    description_for_order: '',
                    positions: []
                };

                setOrder(emptyOrder);
                setDiscountPercent(0);
                localStorage.removeItem(DRAFT_KEY);
                setIsDirty(false);
                setLastSaved(null);
                setConfirmDialog(null);
                showNotification('success', 'Форма очищена');
            }
        });
    };

    // Функция для показа уведомлений (замена alert)
    const showNotification = (type, message) => {
        setNotification({ type, message });
        // Автоматически скрываем через 4 секунды
        setTimeout(() => {
            setNotification(null);
        }, 4000);
    };

    const handleOrderChange = (field, value) => {
        setOrder(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const calculateTotal = () => {
        const subtotal = order.positions.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        if (discountPercent > 0) {
            return Math.round(subtotal * (1 - discountPercent / 100));
        }
        return subtotal;
    };

    const getSubtotal = () => {
        return order.positions.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    };

    // Валидация заказа перед сохранением
    const validateOrder = () => {
        const errors = [];

        if (!order.name_client.trim()) {
            errors.push('Укажите ФИО клиента');
        }
        if (!order.phone.trim()) {
            errors.push('Укажите телефон клиента');
        }
        if (order.positions.length === 0) {
            errors.push('Добавьте хотя бы одну позицию в заказ');
        }

        return errors;
    };

    const saveOrder = async (asDraft = false) => {
        if (isSaving) return;

        // Валидация перед сохранением
        const validationErrors = validateOrder();
        if (validationErrors.length > 0) {
            showNotification('error', validationErrors.join('. '));
            return;
        }

        setIsSaving(true);

        const payload = {
            ...order,
            product_order: order.positions,
            subtotal: calculateTotal(),
            total: calculateTotal(),
            status: asDraft ? 'Черновик' : 'Оформлен'
        };

        try {
            const res = await fetch('http://localhost:8080/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Ошибка сервера');
            const data = await res.json();
            const createdId = data.id || data[0]?.id;

            if (!asDraft) {
                localStorage.removeItem(DRAFT_KEY);
                setIsDirty(false);
                if (createdId) {
                    navigate(`/order/${createdId}`);
                    return;
                }
            } else {
                setIsDirty(false);
            }

            showNotification('success', asDraft ? 'Черновик успешно сохранён' : 'Заказ успешно оформлен!');
        } catch (err) {
            showNotification('error', 'Ошибка сохранения: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="placing_an_order">
            <div className="placing_an_order__content">
                {/* Уведомления */}
                {notification && (
                    <div className={`placing_an_order__notification ${notification.type}`}>
                        {notification.message}
                    </div>
                )}

                {/* Шапка (в стиле кабинета) */}
                <div className="placing_an_order__header">
                    <div className="placing_an_order__title">
                        <h1>Оформление заказа</h1>
                        <p>Заполните данные и добавьте позиции мебели</p>
                    </div>

                    <div className="placing_an_order__summary">
                        <div className="placing_an_order__summary-item">
                            <div className="placing_an_order__summary-label">Позиций</div>
                            <div className="placing_an_order__summary-value">{order.positions.length}</div>
                        </div>
                        <div className="placing_an_order__summary-item">
                            <div className="placing_an_order__summary-label">Итого</div>
                            <div className="placing_an_order__summary-value">{calculateTotal().toLocaleString()} сом</div>
                        </div>
                    </div>
                </div>

                {/* Основная информация о клиенте */}
                <article className="placing_an_order__info-card">
                    <h2 className="placing_an_order__section-title">Основная информация о заказе</h2>
                    <p className="placing_an_order__section-subtitle">Введите данные контрагента для формирования договора</p>

                    <div className="placing_an_order__fields">
                        <label className="placing_an_order__field"><span>ФИО Клиента</span>
                            <input value={order.name_client} onChange={e => handleOrderChange('name_client', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Компания</span>
                            <input value={order.name_compony} onChange={e => handleOrderChange('name_compony', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Адрес</span>
                            <input value={order.address} onChange={e => handleOrderChange('address', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Телефон</span>
                            <input value={order.phone} onChange={e => handleOrderChange('phone', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Email</span>
                            <input value={order.email} onChange={e => handleOrderChange('email', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Цвет материала</span>
                            <input value={order.order_color} onChange={e => handleOrderChange('order_color', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field">
                            <span>Скидка на заказ (%)</span>
                            <input 
                                type="number" 
                                min="0" 
                                max="100"
                                value={discountPercent} 
                                onChange={e => {
                                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                    setDiscountPercent(val);
                                    setIsDirty(true);
                                }} 
                                placeholder="0"
                            />
                        </label>
                        <label className="placing_an_order__field"><span>Примечание</span>
                            <textarea value={order.order_note} onChange={e => handleOrderChange('order_note', e.target.value)} />
                        </label>
                        <label className="placing_an_order__field"><span>Описание заказа</span>
                            <textarea value={order.description_for_order} onChange={e => handleOrderChange('description_for_order', e.target.value)} />
                        </label>
                    </div>
                </article>

                <div className="placing_an_order__add-wrap">
                    <button className="placing_an_order__add-button" onClick={() => openModal('catalog')}>
                        ＋ Добавить из каталога
                    </button>
                    <button className="placing_an_order__add-button custom" onClick={() => openModal('custom')}>
                        ＋ Добавить произвольную позицию
                    </button>
                </div>

                {/* Модальное окно */}
                {modalOpen && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>
                                    {editingItemId ? 'Редактирование позиции' :
                                        modalType === 'catalog' ? 'Добавить из каталога' : 'Новая произвольная позиция'}
                                </h3>
                                <button className="modal-close-btn" onClick={closeModal}>×</button>
                            </div>

                            {modalType === 'catalog' ? (
                                /* Каталог */
                                <div className="modal-body">
                                    <div className="modal-products-grid">
                                        {products.map(p => (
                                            <div key={p.id} className={`modal-product-card ${selectedProduct?.id === p.id ? 'active' : ''}`}
                                                 onClick={() => setSelectedProduct(p)}>
                                                <img src={p.img} alt={p.title} />
                                                <p>{p.title}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedProduct && (
                                        <div className="modal-form">
                                            <h4>{selectedProduct.title}</h4>
                                            <div className="modal-inputs">
                                                {(selectedProduct.variables || []).map(v => (
                                                    <label key={v.name} className="modal-field">
                                                        <span>{v.label}</span>
                                                        <input type="number" value={inputs[v.name] ?? ''}
                                                               onChange={e => setInputs(prev => ({ ...prev, [v.name]: e.target.value }))} />
                                                    </label>
                                                ))}
                                                {(selectedProduct.conditions || []).map(c => c.type === 'flag' && (
                                                    <label key={c.name} className="modal-checkbox">
                                                        <input type="checkbox" checked={!!inputs[c.name]}
                                                               onChange={() => setInputs(prev => ({ ...prev, [c.name]: !prev[c.name] }))} />
                                                        {c.label}
                                                    </label>
                                                ))}
                                            </div>

                                            <label className="modal-field" style={{ gridColumn: '1 / -1' }}>
                                                <span>Описание позиции</span>
                                                <textarea value={customDesc} onChange={e => setCustomDesc(e.target.value)} />
                                            </label>

                                            {/* === ВЫБОР ЦВЕТА (чистый и красивый) === */}
                                            <div className="color-selection-block">
                                                <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '15px', color: '#111827' }}>
                                                    Выбор цвета
                                                </div>

                                                {/* Режим выбора */}
                                                <div className="color-mode-toggle">
                                                    <label className="color-mode-option">
                                                        <input 
                                                            type="radio" 
                                                            name="colorMode" 
                                                            value="unified"
                                                            checked={colorSelection.mode === 'unified'}
                                                            onChange={() => setColorSelection(prev => ({ ...prev, mode: 'unified' }))}
                                                        />
                                                        Единый цвет
                                                    </label>
                                                    <label className="color-mode-option">
                                                        <input 
                                                            type="radio" 
                                                            name="colorMode" 
                                                            value="separate"
                                                            checked={colorSelection.mode === 'separate'}
                                                            onChange={() => setColorSelection(prev => ({ ...prev, mode: 'separate' }))}
                                                        />
                                                        Разные цвета (корпус / фасады)
                                                    </label>
                                                </div>

                                                {/* Популярные свотчи */}
                                                <div>
                                                    <div style={{ fontSize: '12.5px', marginBottom: '6px', color: '#64748b', fontWeight: 600 }}>
                                                        Популярные декоры (Egger, Kronospan, Lamarty)
                                                    </div>
                                                    <div className="color-swatches">
                                                        {FURNITURE_COLORS.map(color => {
                                                            const isSelected = colorSelection.mode === 'unified' 
                                                                ? colorSelection.unified.name === color.name
                                                                : colorSelection.facade.name === color.name;

                                                            return (
                                                                <div
                                                                    key={color.id}
                                                                    className={`color-swatch ${isSelected ? 'selected' : ''}`}
                                                                    onClick={() => {
                                                                        if (colorSelection.mode === 'unified') {
                                                                            setColorSelection(prev => ({
                                                                                ...prev,
                                                                                unified: { name: color.name, image: color.image }
                                                                            }));
                                                                        } else {
                                                                            setColorSelection(prev => ({
                                                                                ...prev,
                                                                                facade: { name: color.name, image: color.image }
                                                                            }));
                                                                        }
                                                                    }}
                                                                >
                                                                    <img src={color.image} alt={color.name} />
                                                                    <div className="name">{color.name}</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Ручной ввод */}
                                                {colorSelection.mode === 'unified' ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12.5px', marginBottom: '4px', fontWeight: 600 }}>Название цвета</div>
                                                            <input 
                                                                value={colorSelection.unified.name} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    unified: { ...prev.unified, name: e.target.value }
                                                                }))} 
                                                                placeholder="Например: Дуб Сонома"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '12.5px', marginBottom: '4px', fontWeight: 600 }}>Фото (URL)</div>
                                                            <input 
                                                                value={colorSelection.unified.image} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    unified: { ...prev.unified, image: e.target.value }
                                                                }))} 
                                                                placeholder="https://..."
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>Корпус</div>
                                                            <input 
                                                                value={colorSelection.body.name} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    body: { ...prev.body, name: e.target.value }
                                                                }))} 
                                                                placeholder="Название цвета корпуса"
                                                                style={{ marginBottom: '6px' }}
                                                            />
                                                            <input 
                                                                value={colorSelection.body.image} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    body: { ...prev.body, image: e.target.value }
                                                                }))} 
                                                                placeholder="URL фото корпуса"
                                                            />
                                                        </div>

                                                        <div>
                                                            <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>Фасады</div>
                                                            <input 
                                                                value={colorSelection.facade.name} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    facade: { ...prev.facade, name: e.target.value }
                                                                }))} 
                                                                placeholder="Название цвета фасадов"
                                                                style={{ marginBottom: '6px' }}
                                                            />
                                                            <input 
                                                                value={colorSelection.facade.image} 
                                                                onChange={e => setColorSelection(prev => ({
                                                                    ...prev, 
                                                                    facade: { ...prev.facade, image: e.target.value }
                                                                }))} 
                                                                placeholder="URL фото фасадов"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {editingItemId && (
                                                <button 
                                                    className="modal-delete-btn"
                                                    onClick={() => {
                                                        setConfirmDialog({
                                                            message: 'Удалить эту позицию из заказа?',
                                                            onConfirm: () => {
                                                                removePosition(editingItemId);
                                                                closeModal();
                                                                setConfirmDialog(null);
                                                            }
                                                        });
                                                    }}
                                                >
                                                    Удалить позицию
                                                </button>
                                            )}

                                            <button className="modal-save-btn" onClick={savePosition}>
                                                {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Произвольная позиция */
                                <div className="modal-body">
                                    <div className="modal-form">
                                    <label className="modal-field"><span>Название позиции *</span>
                                        <input value={customItem.title} onChange={e => setCustomItem(p => ({...p, title: e.target.value}))} />
                                    </label>
                                    <label className="modal-field"><span>Цена за единицу (сом) *</span>
                                        <input type="number" value={customItem.price} onChange={e => setCustomItem(p => ({...p, price: e.target.value}))} />
                                    </label>
                                    <label className="modal-field"><span>Количество</span>
                                        <input type="number" value={customItem.quantity} onChange={e => setCustomItem(p => ({...p, quantity: e.target.value}))} />
                                    </label>
                                    <label className="modal-field" style={{gridColumn: '1/-1'}}>
                                        <span>Описание</span>
                                        <textarea value={customItem.description} onChange={e => setCustomItem(p => ({...p, description: e.target.value}))} />
                                    </label>

                                    <button className="modal-save-btn" onClick={savePosition}>
                                        {editingItemId ? 'Сохранить изменения' : 'Добавить в заказ'}
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Список позиций */}
                <div className="placing_an_order__title-row">
                    <h3>Состав заказа ({order.positions.length})</h3>
                    <div className="total-line">
                        {discountPercent > 0 && (
                            <span style={{ marginRight: '14px', color: '#64748b' }}>
                                Без скидки: {getSubtotal().toLocaleString()} сом (−{discountPercent}%)
                            </span>
                        )}
                        <strong>Итого: {calculateTotal().toLocaleString()} сом</strong>
                    </div>
                </div>

                <div className="placing_an_order__list">
                    {order.positions.length === 0 ? (
                        <div className="placing_an_order__empty-state">
                            <span className="icon">🛋️</span>
                            <p>Пока нет позиций в заказе</p>
                            <small>Добавьте мебель из каталога или создайте произвольную позицию</small>
                        </div>
                    ) : (
                        order.positions.map(item => (
                            <article key={item.id} className="placing_an_order__item-card">
                                {item.img && <img src={item.img} alt={item.title} />}
                                <div className="placing_an_order__item-details">
                                    <h4>{item.title}</h4>
                                    {item.description && (
                                        <div className="meta"><span>Описание</span> {item.description}</div>
                                    )}

                                    {/* Красивое отображение цвета — унифицированный или корпус/фасады */}
                                    {item.colorSelection && (item.colorSelection.unified?.name || item.colorSelection.body?.name) && (
                                        <div className="color-preview">
                                            <div className="color-preview-title">Цвет</div>

                                            {item.colorSelection.mode === 'unified' ? (
                                                <div className="color-unified">
                                                    {item.colorSelection.unified.image && (
                                                        <img 
                                                            src={item.colorSelection.unified.image} 
                                                            alt="" 
                                                            className="color-swatch-large"
                                                        />
                                                    )}
                                                    <span className="color-name">{item.colorSelection.unified.name}</span>
                                                </div>
                                            ) : (
                                                <div className="color-separate">
                                                    <div className="color-pair">
                                                        <span className="color-pair-label">Корпус</span>
                                                        {item.colorSelection.body?.image && (
                                                            <img src={item.colorSelection.body.image} alt="" className="color-swatch-small" />
                                                        )}
                                                        <span className="color-name">{item.colorSelection.body?.name || '—'}</span>
                                                    </div>
                                                    <div className="color-pair">
                                                        <span className="color-pair-label">Фасады</span>
                                                        {item.colorSelection.facade?.image && (
                                                            <img src={item.colorSelection.facade.image} alt="" className="color-swatch-small" />
                                                        )}
                                                        <span className="color-name">{item.colorSelection.facade?.name || '—'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="price-row">
                                        {item.price.toLocaleString()} × {item.quantity} = <b>{item.totalPrice.toLocaleString()} сом</b>
                                    </div>

                                    <div className="placing_an_order__item-actions">
                                        <button type="button" onClick={() => openModal(item.isCustom ? 'custom' : 'catalog', item)}>
                                            Изменить
                                        </button>
                                        <button type="button" onClick={() => duplicatePosition(item)}>
                                            Дублировать
                                        </button>
                                        <button className="placing_an_order__delete" onClick={() => removePosition(item.id)}>
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                <div className="placing_an_order__footer-actions">
                    <button 
                        className="placing_an_order__clear" 
                        onClick={clearForm}
                        disabled={isSaving || (order.positions.length === 0 && !order.name_client)}
                    >
                        Очистить форму
                    </button>

                    <button 
                        className="placing_an_order__draft" 
                        onClick={() => saveOrder(true)}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Сохранение...' : 'Сохранить как черновик'}
                    </button>
                    <button 
                        className="placing_an_order__submit" 
                        onClick={() => saveOrder(false)}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Оформление...' : 'Оформить заказ'}
                    </button>
                </div>
            </div>

            {/* Простое диалоговое окно подтверждения (замена confirm) */}
            {confirmDialog && (
                <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
                    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                        <p>{confirmDialog.message}</p>
                        <div className="confirm-actions">
                            <button 
                                className="confirm-btn"
                                onClick={() => setConfirmDialog(null)}
                            >
                                Отмена
                            </button>
                            <button 
                                className="confirm-btn danger"
                                onClick={confirmDialog.onConfirm}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default PlacingAnOrder;