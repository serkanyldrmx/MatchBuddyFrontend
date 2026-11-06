import './App.css';
import './mobile.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Grid } from 'antd';
import trTR from 'antd/locale/tr_TR';
import { appTheme, mobileTheme } from './theme/theme';
import { MessagesProvider } from './messaging/MessagesContext';
import AppLayout from './layout/AppLayout';
import AdminLayout from './layout/AdminLayout';
import PrivateRoute from './Components/PrivateRoute/PrivateRoute';
import { ROLE } from './utils/roles';
import VenueLayout from './layout/VenueLayout';
import OwnerDashboard from './owner/OwnerDashboard';
import OwnerCalendar from './owner/OwnerCalendar';
import OwnerReservations from './owner/OwnerReservations';
import OwnerVenue from './owner/OwnerVenue';
import OwnerPitches from './owner/OwnerPitches';
import OwnerPricing from './owner/OwnerPricing';
import OwnerCampaigns from './owner/OwnerCampaigns';
import OwnerReviews from './owner/OwnerReviews';
import OwnerFinance from './owner/OwnerFinance';
import Venues from './Components/Venues/Venues';
import VenueDetail from './Components/Venues/VenueDetail';
import CreateMatch from './Components/Venues/CreateMatch';
import AdminBusinesses from './admin/Businesses';
import AdminOsm from './admin/OsmCandidates';

import UserLogin from './Components/UserLogin/UserLogin';
import RegisterForm from './Components/UserLogin/Register';

import Home from './Components/Home/Home';
import MatchDetails from './Components/Home/MatchDetails';
import User from './Components/User/User';
import UserUpdate from './Components/User/UserUpdate';
import Team from './Components/Team/Team';
import CreatTeam from './Components/Team/CreatTeam';
import NotificationList from './Components/Notification/NotificationList';
import TeamAICreate from './Components/AIComponents/TeamAICreate';
import About from './Components/Information/About';
import AboutPage from './Components/Information/AboutPage';
import Communication from './Components/Information/Communication';
import Leaderboard from './Components/Leaderboard/Leaderboard';
import Friends from './Components/Social/Friends';
import PlayerProfile from './Components/Social/PlayerProfile';
import Settings from './Components/Settings/Settings';
import Invites from './Components/Invites/Invites';
import MyCalendar from './Components/Calendar/MyCalendar';
import Feed from './Components/Feed/Feed';
import Tournaments from './Components/Tournaments/Tournaments';
import TournamentDetail from './Components/Tournaments/TournamentDetail';
import AdminReports from './admin/Reports';

import AdminDashboard from './admin/AdminDashboard';
import Reservations from './admin/Reservations';
import AdminMatches from './admin/AdminMatches';
import Stadium from './Components/Stadium/Stadium';
import StadiumIsAdmin from './Components/Stadium/StadiumIsAdmin';

function App() {
  // Telefonlarda (md altı) dokunmaya uygun kontrol boyları; masaüstü teması aynen kalır
  const screens = Grid.useBreakpoint();
  const theme = screens.md === false ? mobileTheme : appTheme;
  return (
    <ConfigProvider theme={theme} locale={trTR}>
      <AntApp>
        <BrowserRouter>
          <MessagesProvider>
            <Routes>
              {/* Giriş / kayıt */}
              <Route path="/" element={<UserLogin />} />
              <Route path="/register" element={<RegisterForm />} />

              {/* Oyuncu ekranları: ortak AppLayout içinde */}
              <Route element={<PrivateRoute role={ROLE.PLAYER} />}>
                <Route element={<AppLayout />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/match-details/:matchId" element={<MatchDetails />} />
                  <Route path="/homeStadium" element={<Navigate to="/venues" replace />} />
                  <Route path="/venues" element={<Venues />} />
                  <Route path="/venues/:stadiumId" element={<VenueDetail />} />
                  <Route path="/matches/new" element={<CreateMatch />} />
                  <Route path="/players" element={<Navigate to="/friends" replace />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/player/:playerId" element={<PlayerProfile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/invites" element={<Invites />} />
                  <Route path="/calendar" element={<MyCalendar />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/tournaments" element={<Tournaments />} />
                  <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/create-team" element={<CreatTeam />} />
                  <Route path="/teamAICreate" element={<TeamAICreate />} />
                  <Route path="/user" element={<User />} />
                  <Route path="/userUpdate" element={<UserUpdate />} />
                  <Route path="/NotificationList" element={<NotificationList />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/aboutPage" element={<AboutPage />} />
                  <Route path="/communication" element={<Communication />} />
                  {/* Mesajlaşma artık sağdan açılan panel; eski adresler paneli açar */}
                  <Route path="/chat" element={null} />
                  <Route path="/chatWindow" element={null} />
                  <Route path="/matchAll" element={<Navigate to="/home" replace />} />
                </Route>
              </Route>

              {/* Admin ekranları: ortak AdminLayout içinde */}
              <Route element={<PrivateRoute role={ROLE.ADMIN} />}>
                <Route path="/adminPanel" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="reservations" element={<Reservations />} />
                  <Route path="matches" element={<AdminMatches />} />
                  <Route path="stadiums" element={<Stadium />} />
                  <Route path="stadiums/new" element={<StadiumIsAdmin />} />
                  <Route path="about" element={<About />} />
                  <Route path="contact" element={<Communication />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="businesses" element={<AdminBusinesses />} />
                  <Route path="osm" element={<AdminOsm />} />
                </Route>
                <Route path="/stadiumIsAdmin" element={<Navigate to="/adminPanel/stadiums/new" replace />} />
              </Route>

              {/* İşletme (anlaşmalı halı saha) ekranları */}
              <Route element={<PrivateRoute role={ROLE.OWNER} />}>
                <Route path="/venue" element={<VenueLayout />}>
                  <Route index element={<OwnerDashboard />} />
                  <Route path="calendar" element={<OwnerCalendar />} />
                  <Route path="reservations" element={<OwnerReservations />} />
                  <Route path="facility" element={<OwnerVenue />} />
                  <Route path="pitches" element={<OwnerPitches />} />
                  <Route path="pricing" element={<OwnerPricing />} />
                  <Route path="campaigns" element={<OwnerCampaigns />} />
                  <Route path="reviews" element={<OwnerReviews />} />
                  <Route path="finance" element={<OwnerFinance />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MessagesProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
