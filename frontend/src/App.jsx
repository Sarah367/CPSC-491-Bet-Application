import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import MyBetsPage from './pages/MyBetsPage';
import BetsListPage from './pages/BetsListPage';
import CreateBetPage from './pages/CreateBetPage';
import BetDetailsPage from './pages/BetDetailsPage';
import './App.css'
import VerifyEmailPage from './pages/VerifyEmailPage';
import EditBetPage from './pages/EditBetPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/register" element={<RegisterPage/>} />
        <Route path="/home" element={<HomePage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
        <Route path="/my-bets" element={<MyBetsPage/>}/>
        <Route path="/bets" element={<BetsListPage/>}/>
        <Route path="/bets/create" element={<CreateBetPage/>}/>
        <Route path="/bets/:betId" element={<BetDetailsPage/>}/>
        <Route path="/bets/:betId/edit" element={<EditBetPage/>}/>
        <Route path="/verify-email" element={<VerifyEmailPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

