import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import MyBetsPage from './pages/MyBetsPage';
import CreateBetPage from './pages/CreateBetPage';
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/register" element={<RegisterPage/>} />
        <Route path="/home" element={<HomePage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
        <Route path="/my-bets" element={<MyBetsPage/>}/>
        <Route path="/bets/create" element={<CreateBetPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
