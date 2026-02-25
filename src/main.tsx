import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import AdminPage from './admin'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/entrega" element={<App />} />
        <Route path="/master" element={<App />} />
        <Route path="/admin" element={<App />} />
        <Route path="/admin/:password" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
