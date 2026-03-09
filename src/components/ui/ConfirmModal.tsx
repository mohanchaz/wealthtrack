import { Modal }  from './Modal'
import { Button } from './Button'

interface Props {
  message:   string
  onConfirm: () => void
  onCancel:  () => void
  danger?:   boolean
}

export function ConfirmModal({ message, onConfirm, onCancel, danger = true }: Props) {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Confirm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>Delete</Button>
        </>
      }
    >
      <p className="text-sm text-textmut leading-relaxed">{message}</p>
    </Modal>
  )
}
