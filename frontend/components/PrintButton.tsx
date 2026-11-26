'use client'

export default function PrintButton() {
  return (
    <button className="cv-btn cv-btn-primary" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  )
}
