import React, { useState, useEffect } from 'react';

interface ModalProps {
    type: 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (value?: string) => void;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({
    type,
    title,
    message,
    defaultValue = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onClose,
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    const handleConfirm = () => {
        onConfirm(type === 'prompt' ? inputValue : undefined);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 transition-opacity duration-300"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 border border-purple-500/50"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold font-title text-purple-300 mb-4">{title}</h2>
                <p className="text-gray-300 mb-6">{message}</p>
                
                {type === 'prompt' && (
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition mb-6"
                        autoFocus
                    />
                )}

                <div className="flex justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
