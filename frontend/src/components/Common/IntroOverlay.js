import React, { useMemo } from 'react';
import './IntroOverlay.css';

const greetings = [
    'Chào mừng quay lại!',
    'Sẵn sàng cho một ngày hiệu quả?',
    'Tận hưởng trải nghiệm quản lý HR!',
    'Chúc bạn một ngày làm việc tuyệt vời!',
];

const IntroOverlay = ({ user }) => {
    const greeting = useMemo(() => {
        const index = Math.floor(Math.random() * greetings.length);
        return greetings[index];
    }, []);

    return (
        <div className="intro-overlay">
            <div className="intro-overlay-backdrop" />
            <div className="intro-overlay-card">
                <div className="intro-overlay-spinner" aria-hidden="true" />
                <div className="intro-overlay-content">
                    <span className="intro-overlay-subtitle">Đăng nhập thành công</span>
                    <h2 className="intro-overlay-title">{greeting}</h2>
                    <p className="intro-overlay-user">
                        Xin chào <strong>{user?.hoTen || user?.username || 'bạn'}</strong>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default IntroOverlay;

