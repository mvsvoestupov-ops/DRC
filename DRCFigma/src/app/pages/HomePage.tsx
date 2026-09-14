import { Link } from "react-router";
import { Search, Plus, TrendingUp, FileText, Users, Building2, CheckCircle, Clock, Archive } from "lucide-react";
import { competencies, industries, stats } from "../data/competencies";

export function HomePage() {
  const recentCompetencies = competencies.slice(0, 3);

  const statusColors = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    draft: "bg-gray-50 text-gray-700 border-gray-200",
    review: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-slate-50 text-slate-700 border-slate-200"
  };

  const statusLabels = {
    active: "Действует",
    draft: "Проект",
    review: "На экспертизе",
    archived: "Архив"
  };

  return (
    <div style={{ backgroundColor: '#F5F7FA' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #3B82F6 100%)',
        color: 'white'
      }}>
        <div className="max-w-[1440px] mx-auto px-8 py-20">
          <div className="max-w-3xl">
            <h1 style={{ fontSize: '48px', fontWeight: '700', lineHeight: '1.2', marginBottom: '24px' }}>
              Национальный реестр компетенций
            </h1>
            <p style={{ fontSize: '20px', lineHeight: '1.6', opacity: '0.95', marginBottom: '40px' }}>
              Единая система управления компетенциями для гармонизации образовательных программ,
              профессиональных стандартов и требований работодателей
            </p>
            <div className="flex gap-4">
              <Link
                to="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 32px',
                  backgroundColor: 'white',
                  color: '#1E40AF',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                className="hover:shadow-lg transition-all"
              >
                <Search className="w-5 h-5" />
                Найти компетенцию
              </Link>
              <Link
                to="/new"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 32px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  border: '2px solid rgba(255, 255, 255, 0.3)'
                }}
                className="hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <Plus className="w-5 h-5" />
                Предложить компетенцию
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="max-w-[1440px] mx-auto px-8 -mt-12">
        <div className="grid grid-cols-4 gap-6 mb-16">
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#EFF6FF',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText className="w-7 h-7" style={{ color: '#3B82F6' }} />
              </div>
              <TrendingUp className="w-6 h-6" style={{ color: '#10B981' }} />
            </div>
            <div style={{ fontSize: '40px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              {stats.total.toLocaleString()}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
              Всего компетенций
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#ECFDF5',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle className="w-7 h-7" style={{ color: '#10B981' }} />
              </div>
            </div>
            <div style={{ fontSize: '40px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              {stats.active.toLocaleString()}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
              Действующих компетенций
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#FEF3C7',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock className="w-7 h-7" style={{ color: '#F59E0B' }} />
              </div>
            </div>
            <div style={{ fontSize: '40px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              {stats.review}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
              На экспертизе
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#F1F5F9',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Archive className="w-7 h-7" style={{ color: '#64748B' }} />
              </div>
            </div>
            <div style={{ fontSize: '40px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              {stats.archived}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
              Архивных записей
            </div>
          </div>
        </div>

        {/* Recent Competencies */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Последние добавленные компетенции
              </h2>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                Недавно утверждённые и добавленные в реестр
              </p>
            </div>
            <Link
              to="/search"
              style={{
                color: '#3B82F6',
                fontSize: '14px',
                fontWeight: '600'
              }}
              className="hover:underline"
            >
              Смотреть все →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {recentCompetencies.map((competency) => (
              <Link
                key={competency.id}
                to={`/competency/${competency.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #E5E7EB',
                  display: 'block'
                }}
                className="hover:shadow-lg hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <span style={{
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#3B82F6',
                    fontWeight: '600'
                  }}>
                    {competency.id}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid'
                  }} className={statusColors[competency.status]}>
                    {statusLabels[competency.status]}
                  </span>
                </div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px',
                  lineHeight: '1.5',
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {competency.title}
                </h3>
                <div className="flex items-center gap-4" style={{ fontSize: '13px', color: '#6B7280' }}>
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {competency.industry}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Popular Industries */}
        <div className="pb-16">
          <div className="mb-8">
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Популярные отрасли
            </h2>
            <p style={{ fontSize: '14px', color: '#6B7280' }}>
              Найдите компетенции по отраслям экономики
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {industries.map((industry) => (
              <Link
                key={industry}
                to={`/search?industry=${encodeURIComponent(industry)}`}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  textAlign: 'center',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#374151'
                }}
                className="hover:shadow-md hover:border-blue-400 hover:text-blue-600 transition-all"
              >
                {industry}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
