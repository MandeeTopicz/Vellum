import { useState, useRef, useEffect } from 'react'
import './AccountDropdown.css'

export default function AccountDropdown() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const menuItems = [
    { label: 'Update Username', comingSoon: true },
    { label: 'Update Password', comingSoon: true },
    { label: 'Update Title/Bio', comingSoon: true },
  ]

  return (
    <div className="account-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="account-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Account"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Account
      </button>
      {open && (
        <div className="account-panel">
          <ul className="account-menu">
            {menuItems.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="account-menu-item"
                  disabled={item.comingSoon}
                  title={item.comingSoon ? 'Coming soon' : undefined}
                >
                  {item.label}
                  {item.comingSoon && (
                    <span className="account-coming-soon">Coming soon</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
