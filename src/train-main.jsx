import React from 'react'
import ReactDOM from 'react-dom/client'
import TrainPage from './TrainPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <TrainPage />
    </LangProvider>
  </React.StrictMode>,
)
