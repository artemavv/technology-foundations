import React from 'react'
import ReactDOM from 'react-dom/client'
import ChronosAdminPage from './ChronosAdminPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <ChronosAdminPage />
    </LangProvider>
  </React.StrictMode>,
)
