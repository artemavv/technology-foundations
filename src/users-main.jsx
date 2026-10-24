import React from 'react'
import ReactDOM from 'react-dom/client'
import UsersPage from './UsersPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <UsersPage />
    </LangProvider>
  </React.StrictMode>,
)
