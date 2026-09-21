import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CT Saúde Total',
  description: 'Painel de relacionamento e inteligência sobre o aluno',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
