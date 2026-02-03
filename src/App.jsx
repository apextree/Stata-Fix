import './App.css';
import React from 'react';
import { useRoutes } from 'react-router-dom'
import SeePolipions from './pages/SeePolipions'
import MyPolipions from './pages/MyPolipions'
import CreatePolipion from './pages/CreatePolipion'
import EditPolipion from './pages/EditPolipion'
import PolipionDetails from './pages/PolipionDetails'
import Leaderboard from './pages/Leaderboard'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'
import Sidebar from './components/Sidebar'
import ThemeToggle from './components/ThemeToggle'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

const App = () => {
  
  let element = useRoutes([
    {
      path: "/",
      element: <Home />
    },
    {
      path: "/login",
      element: <Login />
    },
    {
      path: "/register",
      element: <Register />
    },
    {
      path: "/polipions",
      element: <ProtectedRoute><SeePolipions /></ProtectedRoute>
    },
    {
      path: "/my-polipions",
      element: <ProtectedRoute><MyPolipions /></ProtectedRoute>
    },
    {
      path: "/polipion/:id",
      element: <ProtectedRoute><PolipionDetails /></ProtectedRoute>
    },
    {
      path:"/edit/:id",
      element: <ProtectedRoute><EditPolipion /></ProtectedRoute>
    },
    {
      path:"/new",
      element: <ProtectedRoute><CreatePolipion /></ProtectedRoute>
    },
    {
      path: "/leaderboard",
      element: <ProtectedRoute><Leaderboard /></ProtectedRoute>
    },
    {
      path: "*",
      element: <NotFound />
    }
  ]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <ThemeToggle />
          <Sidebar />
          <div className="main-content">
            {element}
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
