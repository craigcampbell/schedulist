import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertModal } from '../components/ui/modal';

const ModalContext = createContext({});

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
    resolver: null
  });

  const showModal = useCallback((options) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title: options.title || 'Alert',
        message: options.message || '',
        type: options.type || 'info',
        buttons: options.buttons || [{ 
          label: 'OK', 
          variant: 'default',
          action: () => resolve(true)
        }],
        resolver: resolve
      });
    });
  }, []);

  const alert = useCallback((message, title = 'Alert', type = 'info') => {
    return showModal({
      title,
      message,
      type,
      buttons: [{ 
        label: 'OK', 
        variant: 'default',
        action: () => modalState.resolver?.(true)
      }]
    });
  }, [showModal, modalState.resolver]);

  const confirm = useCallback((message, title = 'Confirm', type = 'warning') => {
    return showModal({
      title,
      message,
      type,
      buttons: [
        { 
          label: 'Cancel', 
          variant: 'outline',
          action: () => modalState.resolver?.(false)
        },
        { 
          label: 'Confirm', 
          variant: 'default',
          action: () => modalState.resolver?.(true)
        }
      ]
    });
  }, [showModal, modalState.resolver]);

  const confirmDelete = useCallback((itemName, customMessage) => {
    const message = customMessage || `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
    return showModal({
      title: 'Delete Confirmation',
      message,
      type: 'error',
      buttons: [
        { 
          label: 'Cancel', 
          variant: 'outline',
          action: () => modalState.resolver?.(false)
        },
        { 
          label: 'Delete', 
          variant: 'destructive',
          action: () => modalState.resolver?.(true)
        }
      ]
    });
  }, [showModal, modalState.resolver]);

  const prompt = useCallback((message, title = 'Input Required', defaultValue = '') => {
    // For now, we'll use the native prompt. 
    // In the future, we can create a custom input modal
    const result = window.prompt(message, defaultValue);
    return Promise.resolve(result);
  }, []);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    // Resolve with false if closed without action
    if (modalState.resolver) {
      modalState.resolver(false);
    }
  }, [modalState.resolver]);

  const value = {
    alert,
    confirm,
    confirmDelete,
    prompt,
    showModal,
    closeModal
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <AlertModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        buttons={modalState.buttons.map(button => ({
          ...button,
          action: () => {
            button.action?.();
            closeModal();
          }
        }))}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}