interface AddLocationActionsProps {
  isFormValid: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function AddLocationActions({ isFormValid, onCancel, onSave }: AddLocationActionsProps) {
  return (
    <div className="flex gap-3 p-5 border-t border-gray-100">
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
      >
        취소
      </button>
      <button
        onClick={onSave}
        disabled={!isFormValid}
        className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
          isFormValid
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        저장
      </button>
    </div>
  );
}
