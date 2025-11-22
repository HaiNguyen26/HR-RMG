import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 3000, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onRemove]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-message">{message}</span>
      </div>
    </div>
  );
};

export default Toast;

