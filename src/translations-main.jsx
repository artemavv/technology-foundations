import React from 'react'
import ReactDOM from 'react-dom/client'
import TranslationsPage from './TranslationsPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <TranslationsPage />
    </LangProvider>
  </React.StrictMode>,
)
