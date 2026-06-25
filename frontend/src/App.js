import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { HomeOutlined, ApartmentOutlined, PlusOutlined, BookOutlined } from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import StandardsPage from './pages/StandardsPage';
import QualificationsList from './pages/QualificationsList';
import QualificationDetail from './pages/QualificationDetail';
import CreateCompetenceWizard from './pages/CreateCompetenceWizard';
import CompetenceDetail from './pages/CompetenceDetail';

const { Header, Content, Footer } = Layout;

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>Национальный реестр компетенций</div>
            <Menu mode="horizontal" theme="light" style={{ borderBottom: 'none' }}>
              <Menu.Item key="home" icon={<HomeOutlined />}>
                <Link to="/">Главная</Link>
              </Menu.Item>
              <Menu.Item key="standards" icon={<ApartmentOutlined />}>
                <Link to="/standards">Профстандарты</Link>
              </Menu.Item>
              <Menu.Item key="qualifications" icon={<BookOutlined />}>
                <Link to="/qualifications">Квалификации</Link>
              </Menu.Item>
              <Menu.Item key="create" icon={<PlusOutlined />}>
                <Link to="/create-competence">Предложить компетенцию</Link>
              </Menu.Item>
            </Menu>
          </div>
        </Header>
        <Content style={{ minHeight: 'calc(100vh - 134px)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/standards" element={<StandardsPage />} />
            <Route path="/qualifications" element={<QualificationsList />} />
            <Route path="/qualifications/:id" element={<QualificationDetail />} />
            <Route path="/create-competence" element={<CreateCompetenceWizard />} />
            <Route path="/competence/:id" element={<CompetenceDetail />} />
          </Routes>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          © 2026 Национальный реестр компетенций
        </Footer>
      </Layout>
    </BrowserRouter>
  );
}

export default App;