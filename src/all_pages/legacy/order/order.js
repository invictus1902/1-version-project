import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './order.scss';

const Order = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:8080/order/${id}`)
            .then(res => res.json())
            .then(data => {
                const loaded = data.order?.[0] || data;

                loaded.product_order = (loaded.product_order || []).map(item => {
                    if (!item.calculatedDetails?.length) {
                        const nums = item.userInputs || {};
                        const details = (item.details || []).map(d => {
                            if (d.if_condition && !nums[d.if_condition]) return null;
                            try {
                                const w = nums[d.formula_width] || 0;
                                const h = d.formula_height ? nums[d.formula_height] : null;
                                const cnt = nums[d.count_formula] || 1;
                                const size = h ? `${Math.round(w)} × ${Math.round(h)} мм` : `${Math.round(w)} мм`;
                                return { key: d.key, label: d.label, size, count: Math.round(cnt) };
                            } catch {
                                return { key: d.key, label: d.label, size: 'Ошибка', count: 0 };
                            }
                        }).filter(Boolean);
                        return { ...item, calculatedDetails: details };
                    }
                    return item;
                });

                const subtotal = loaded.product_order.reduce((s, p) => {
                    return s + Number(p.price || 0) * (Number(p.userInputs?.coll || 1) || 1);
                }, 0);

                setOrder({ ...loaded, subtotal, total: subtotal });
                setLoading(false);
            })
            .catch(err => {
                setError('Не удалось загрузить заказ');
                setLoading(false);
            });
    }, [id]);

    const exportSpec = () => {
        if (!order) return;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Спецификация №${order.id}`, 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 105, 30, { align: 'center' });

        const table = order.product_order.map((p, i) => [
            i + 1,
            p.title,
            p.userInputs?.coll || 1,
            Number(p.price).toLocaleString(),
            (Number(p.price) * (p.userInputs?.coll || 1)).toLocaleString()
        ]);

        doc.autoTable({
            head: [['№', 'Позиция', 'Кол-во', 'Цена', 'Сумма']],
            body: table,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        const y = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(14);
        doc.text(`ИТОГО: ${order.total?.toLocaleString() || 0} сом`, 105, y, { align: 'center' });

        doc.save(`spec_${order.id}.pdf`);
    };

    const exportContract = () => {
        if (!order) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Договор №${order.id}`, 105, 20, { align: 'center' });
        // Добавь текст договора, если нужно
        doc.setFontSize(12);
        doc.text(`Сумма: ${order.total?.toLocaleString() || 0} сом`, 20, 60);
        doc.save(`contract_${order.id}.pdf`);
    };

    if (loading) {
        return (
            <div className="order-page">
                <div className="loading">Загрузка заказа...</div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="order-page">
                <div className="error">{error}</div>
            </div>
        );
    }
    if (!order) {
        return (
            <div className="order-page">
                <div className="empty">Заказ не найден</div>
            </div>
        );
    }

    return (
        <div className="order-page">
            <div className="order-page__content">
                {/* Шапка — крупная, с итогом и кнопками экспорта */}
                <header className="order-page__header">
                    <div className="order-page__title">
                        <h1>Заказ №{order.id}</h1>
                        <span className="order-page__status">
                            {order.status || 'Оформлен'}
                        </span>
                    </div>

                    <div className="order-page__header-actions">
                        <div className="order-page__total-pill">
                            Итого: <strong>{(order.total || order.subtotal || 0).toLocaleString()} сом</strong>
                        </div>

                        <button
                            className="order-page__pdf-btn order-page__pdf-btn--primary"
                            onClick={exportSpec}
                        >
                            Спецификация PDF
                        </button>
                        <button
                            className="order-page__pdf-btn order-page__pdf-btn--secondary"
                            onClick={exportContract}
                        >
                            Договор PDF
                        </button>
                    </div>
                </header>

                {/* Информация о клиенте + сводка */}
                <div className="order-page__meta">
                    <div className="order-page__client-card">
                        <h3>Клиент и доставка</h3>
                        <div className="client-name">{order.name_client || '—'}</div>
                        {order.name_compony && (
                            <div className="client-company">{order.name_compony}</div>
                        )}

                        <div className="client-row">
                            <span className="label">Адрес</span>
                            <span className="value">{order.address || '—'}</span>
                        </div>

                        {order.phone && (
                            <div className="client-row">
                                <span className="label">Телефон</span>
                                <span className="value">{order.phone}</span>
                            </div>
                        )}

                        {order.email && (
                            <div className="client-row">
                                <span className="label">Email</span>
                                <span className="value">{order.email}</span>
                            </div>
                        )}

                        {order.order_note && (
                            <div className="note">Примечание: {order.order_note}</div>
                        )}
                    </div>

                    <div className="order-page__meta-card">
                        <div className="meta-row">
                            <span className="label">Статус</span>
                            <span className="value">{order.status || 'Оформлен'}</span>
                        </div>
                        <div className="meta-row">
                            <span className="label">Позиций</span>
                            <span className="value">{order.product_order?.length || 0}</span>
                        </div>
                        <div className="meta-row">
                            <span className="label">Сумма позиций</span>
                            <span className="value">{(order.subtotal || 0).toLocaleString()} сом</span>
                        </div>

                        <div className="grand-total">
                            <div className="meta-row">
                                <span className="label">К оплате</span>
                                <span className="value">{(order.total || order.subtotal || 0).toLocaleString()} сом</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Позиции */}
                <section>
                    <div className="order-page__positions-header">
                        <h2>Позиции заказа <span>({order.product_order?.length || 0})</span></h2>
                        <div className="count">Сумма: {(order.subtotal || 0).toLocaleString()} сом</div>
                    </div>

                    <div className="order-page__positions-list">
                        {order.product_order?.map(item => (
                            <article key={item.id} className="order-page__position-card">
                                {item.img && (
                                    <img
                                        src={item.img?.startsWith('http') ? item.img : `/utilse/${item.img?.split('/').pop()}`}
                                        alt={item.title}
                                        onError={e => (e.target.src = '/utilse/placeholder.jpg')}
                                    />
                                )}

                                <div className="position-main">
                                    <h3 className="position-title">{item.title}</h3>
                                    {item.description && (
                                        <div className="position-desc">{item.description}</div>
                                    )}

                                    {/* Красивое отображение цвета (если есть — данные из оформления заказа) */}
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

                                    <div className="position-price">
                                        {Number(item.price).toLocaleString()} сом × {item.userInputs?.coll || 1} ={' '}
                                        <strong>
                                            {(Number(item.price) * (item.userInputs?.coll || 1)).toLocaleString()} сом
                                        </strong>
                                    </div>

                                    {item.calculatedDetails && item.calculatedDetails.length > 0 && (
                                        <button
                                            className="position-toggle"
                                            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                                        >
                                            {expanded === item.id ? 'Скрыть деталировку' : 'Показать деталировку'}
                                        </button>
                                    )}

                                    {expanded === item.id && item.calculatedDetails?.length > 0 && (
                                        <div className="position-details-expanded">
                                            <table className="details-table">
                                                <thead>
                                                    <tr>
                                                        <th>Деталь</th>
                                                        <th>Размер</th>
                                                        <th>Кол-во</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {item.calculatedDetails.map(d => (
                                                        <tr key={d.key}>
                                                            <td>{d.label}</td>
                                                            <td>{d.size}</td>
                                                            <td>{d.count}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {/* Нижняя сводка + действия */}
                <div className="order-page__summary-bar">
                    <div className="summary-text">
                        Итого к оплате: <strong>{(order.total || order.subtotal || 0).toLocaleString()} сом</strong>
                    </div>

                    <div className="actions">
                        <button
                            className="order-page__pdf-btn order-page__pdf-btn--primary"
                            onClick={exportSpec}
                        >
                            Скачать спецификацию
                        </button>
                        <button
                            className="order-page__pdf-btn order-page__pdf-btn--secondary"
                            onClick={exportContract}
                        >
                            Скачать договор
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Order;