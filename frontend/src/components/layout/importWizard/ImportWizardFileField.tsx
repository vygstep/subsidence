interface ImportWizardFileFieldProps {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function ImportWizardFileField({
  label,
  value,
  placeholder,
  onChange,
}: ImportWizardFileFieldProps) {
  return (
    <label className="project-dialog__field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus
      />
    </label>
  )
}
