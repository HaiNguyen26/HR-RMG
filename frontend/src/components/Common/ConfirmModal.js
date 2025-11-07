import React, { useState, useEffect } from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', type = 'warning', input, notesInput }) => {
    const [inputValue, setInputValue] = useState('');
    const [notesValue, setNotesValue] = useState('');

    useEffect(() => {
        if (isOpen && input) {
            setInputValue(input.defaultValue || '');
        }
        if (isOpen && notesInput) {
            setNotesValue('');
        }
    }, [isOpen, input, notesInput]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return (
                    <div className="confirm-modal-icon confirm-modal-icon-danger">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                            </path>
                        </svg>
                    </div>
                );
            case 'warning':
                return (
                    <div className="confirm-modal-icon confirm-modal-icon-warning">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                            </path>
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="confirm-modal-icon confirm-modal-icon-info">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
                            </path>
                        </svg>
                    </div>
                );
        }
    };

    return (
        <div className="confirm-modal-overlay" onClick={onClose}>
            <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-modal-content">
                    {getIcon()}
                    <h3 className="confirm-modal-title">{title || 'Xác nhận'}</h3>
                    <p className="confirm-modal-message">{message}</p>
                    
                    {input && (
                        <div className="confirm-modal-input-group">
                            <label className="confirm-modal-input-label">
                                {input.label || 'Nhập giá trị:'}
                            </label>
                            <input
                                type={input.type || 'text'}
                                className="confirm-modal-input"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={input.placeholder}
                                min={input.min}
                                max={input.max}
                                step={input.step}
                                autoFocus
                            />
                            {input.error && (
                                <span className="confirm-modal-input-error">{input.error}</span>
                            )}
                        </div>
                    )}
                    
                    {notesInput && (
                        <div className="confirm-modal-input-group">
                            <label className="confirm-modal-input-label">
                                {notesInput.label || 'Ghi chú (tùy chọn):'}
                            </label>
                            <textarea
                                className="confirm-modal-textarea"
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                placeholder={notesInput.placeholder || 'Nhập ghi chú...'}
                                rows={3}
                            />
                        </div>
                    )}
                    
                    <div className="confirm-modal-actions">
                        <button
                            className="confirm-modal-btn confirm-modal-btn-cancel"
                            onClick={onClose}
                        >
                            {cancelText}
                        </button>
                        <button
                            className={`confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-${type}`}
                            onClick={() => {
                                onConfirm(input ? { value: inputValue, notes: notesValue } : { notes: notesValue });
                                onClose();
                            }}
                            disabled={input && input.required && !inputValue}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;

