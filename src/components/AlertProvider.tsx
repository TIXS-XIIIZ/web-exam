import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Trash2, 
  AlertCircle
} from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export interface AlertModalOptions {
  title: string
  message: string
  buttonText?: string
  type?: 'success' | 'error' | 'warning' | 'info'
}

interface AlertContextValue {
  toast: {
    success: (message: string, title?: string, duration?: number) => void
    error: (message: string, title?: string, duration?: number) => void
    warning: (message: string, title?: string, duration?: number) => void
    info: (message: string, title?: string, duration?: number) => void
  }
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertModalOptions | string) => Promise<void>
}

const AlertContext = createContext<AlertContextValue | null>(null)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Confirm Modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  // Alert Modal state
  const [alertModalState, setAlertModalState] = useState<{
    isOpen: boolean
    options: AlertModalOptions
    resolve: () => void
  } | null>(null)

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastItem = { id, type, message, title, duration }

    setToasts((prev) => [newToast, ...prev].slice(0, 5)) // Max 5 active toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = useRef({
    success: (message: string, title?: string, duration?: number) => addToast('success', message, title, duration),
    error: (message: string, title?: string, duration?: number) => addToast('error', message, title, duration),
    warning: (message: string, title?: string, duration?: number) => addToast('warning', message, title, duration),
    info: (message: string, title?: string, duration?: number) => addToast('info', message, title, duration),
  }).current

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve: (val: boolean) => {
          setConfirmState(null)
          resolve(val)
        },
      })
    })
  }, [])

  const alertModal = useCallback((options: AlertModalOptions | string): Promise<void> => {
    const opts: AlertModalOptions = typeof options === 'string'
      ? { title: 'แจ้งเตือน', message: options }
      : options

    return new Promise((resolve) => {
      setAlertModalState({
        isOpen: true,
        options: opts,
        resolve: () => {
          setAlertModalState(null)
          resolve()
        },
      })
    })
  }, [])

  return (
    <AlertContext.Provider value={{ toast, confirm, alert: alertModal }}>
      {children}

      {/* ========================================================================= */}
      {/* Toast Notification Container (Top-Right / Top-Center on Mobile) */}
      {/* ========================================================================= */}
      <div 
        aria-live="polite"
        className="fixed top-4 right-0 left-0 sm:left-auto sm:right-5 z-50 flex flex-col items-center sm:items-end gap-2.5 px-4 pointer-events-none max-w-sm sm:max-w-md w-full ml-auto"
      >
        {toasts.map((t) => {
          const typeConfig = {
            success: {
              border: 'border-emerald-200/90',
              bg: 'bg-white/95 text-emerald-950',
              iconBg: 'bg-emerald-100 text-emerald-600',
              icon: <CheckCircle2 size={18} strokeWidth={2.5} />,
              progressBar: 'bg-emerald-500',
            },
            error: {
              border: 'border-rose-200/90',
              bg: 'bg-white/95 text-rose-950',
              iconBg: 'bg-rose-100 text-rose-600',
              icon: <XCircle size={18} strokeWidth={2.5} />,
              progressBar: 'bg-rose-500',
            },
            warning: {
              border: 'border-amber-200/90',
              bg: 'bg-white/95 text-amber-950',
              iconBg: 'bg-amber-100 text-amber-600',
              icon: <AlertTriangle size={18} strokeWidth={2.5} />,
              progressBar: 'bg-amber-500',
            },
            info: {
              border: 'border-indigo-200/90',
              bg: 'bg-white/95 text-indigo-950',
              iconBg: 'bg-indigo-100 text-indigo-600',
              icon: <Info size={18} strokeWidth={2.5} />,
              progressBar: 'bg-indigo-500',
            },
          }[t.type]

          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${typeConfig.border} ${typeConfig.bg} backdrop-blur-md shadow-xl shadow-slate-900/10 p-3.5 pr-9 sm:p-4 sm:pr-10 max-w-sm w-full transition-all duration-300 transform translate-y-0 opacity-100 animate-toast`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl ${typeConfig.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
                  {typeConfig.icon}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  {t.title && (
                    <h4 className="text-xs sm:text-sm font-bold leading-snug mb-0.5 text-slate-900">
                      {t.title}
                    </h4>
                  )}
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words font-medium">
                    {t.message}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="ปิด"
              >
                <X size={15} />
              </button>

              {/* Subtle Auto-dismiss Progress Bar */}
              {t.duration && t.duration > 0 && (
                <div
                  className={`absolute bottom-0 left-0 right-0 h-0.5 ${typeConfig.progressBar} opacity-70`}
                  style={{
                    animation: `shrink ${t.duration}ms linear forwards`,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* Confirmation Modal Dialog (Replaces native window.confirm) */}
      {/* ========================================================================= */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-modal"
          >
            <div className="flex items-start gap-4">
              {confirmState.options.type === 'danger' ? (
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20 ring-4 ring-rose-50 animate-glow-rose">
                  <Trash2 size={24} />
                </div>
              ) : confirmState.options.type === 'warning' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20 ring-4 ring-amber-50">
                  <AlertTriangle size={24} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20 ring-4 ring-indigo-50">
                  <AlertCircle size={24} />
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {confirmState.options.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {confirmState.options.cancelText || 'ยกเลิก'}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md active:scale-95 transition-all cursor-pointer ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {confirmState.options.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Alert Modal Dialog (Replaces native window.alert) */}
      {/* ========================================================================= */}
      {alertModalState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-modal"
          >
            <div className="flex items-start gap-4">
              {alertModalState.options.type === 'error' ? (
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20 ring-4 ring-rose-50 animate-glow-rose">
                  <XCircle size={24} />
                </div>
              ) : alertModalState.options.type === 'warning' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20 ring-4 ring-amber-50">
                  <AlertTriangle size={24} />
                </div>
              ) : alertModalState.options.type === 'success' ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 ring-4 ring-emerald-50">
                  <CheckCircle2 size={24} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20 ring-4 ring-indigo-50">
                  <Info size={24} />
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {alertModalState.options.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {alertModalState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => alertModalState.resolve()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                {alertModalState.options.buttonText || 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}
