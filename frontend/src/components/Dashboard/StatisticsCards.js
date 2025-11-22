import React, { useMemo } from 'react';
import './StatisticsCards.css';

const StatisticsCards = ({ statistics, loading }) => {
  const leaveRatio = statistics?.tyLeNghiPhep || 0;
  const resignRatio = statistics?.tyLeNghiViec || 0;

  // Tạo dữ liệu biểu đồ dựa trên tỷ lệ hiện tại
  const generateChartPath = (ratio, maxY = 60) => {
    const baseY = maxY - 10;
    const targetY = baseY - (ratio / 100) * 30;
    
    // Tạo đường cong mượt mà với dữ liệu mẫu
    const points = [
      { x: 0, y: baseY - 5 },
      { x: 40, y: targetY + 10 },
      { x: 80, y: targetY + 5 },
      { x: 120, y: targetY },
      { x: 160, y: targetY - 3 },
      { x: 200, y: targetY - 5 },
    ];

    // Chuyển đổi thành path SVG với đường cong mượt
    let pathData = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) / 3;
      const cp2y = curr.y;
      pathData += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
    }
    
    // Tạo path cho area (thêm điểm dưới cùng bên phải và trái)
    const areaPath = `${pathData} L ${points[points.length - 1].x},${maxY} L ${points[0].x},${maxY} Z`;
    
    return { linePath: pathData, areaPath };
  };

  const leaveChart = useMemo(() => generateChartPath(leaveRatio), [leaveRatio]);
  const resignChart = useMemo(() => generateChartPath(resignRatio), [resignRatio]);

  if (loading) {
    return (
      <div className="statistics-cards-row-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card-gradient loading">
            <div className="stat-card-skeleton"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="statistics-cards-row-2">
      {/* Tổng nhân viên */}
      <div className="stat-card-gradient blue">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Tổng nhân viên</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z">
              </path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.tongNhanVien || 0}</p>
          <p className="stat-card-gradient-subtext">+5 tháng trước</p>
        </div>
      </div>

      {/* Tổng đơn đã gửi */}
      <div className="stat-card-gradient teal">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Tổng đơn đã gửi</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m4 0V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10m16 0a2 2 0 01-2 2H7a2 2 0 01-2-2m16 0h-6"></path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.tongDon || 0}</p>
          <p className="stat-card-gradient-subtext">Bao gồm nghỉ phép, tăng ca, chấm công</p>
        </div>
      </div>

      {/* Đơn đã duyệt */}
      <div className="stat-card-gradient green">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Đơn đã duyệt</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.donDaDuyet || 0}</p>
          <p className="stat-card-gradient-subtext">Tháng này</p>
        </div>
      </div>

      {/* Chờ duyệt */}
      <div className="stat-card-gradient orange">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Chờ duyệt</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.choDuyet || 0}</p>
          <p className="stat-card-gradient-subtext">Cần xử lý</p>
        </div>
      </div>

      {/* Tỷ lệ nhân viên mới nhận việc */}
      <div className="stat-card-gradient purple">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content ratio-card">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Tỷ lệ nhân viên mới nhận việc</p>
            <p className="stat-card-gradient-value-ratio">{leaveRatio}%</p>
          </div>
          <div className="stat-card-chart-container">
            <svg className="stat-card-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="leaveChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(168, 85, 247, 0.3)" />
                  <stop offset="100%" stopColor="rgba(168, 85, 247, 0.02)" />
                </linearGradient>
              </defs>
              <path
                d={leaveChart.areaPath}
                fill="url(#leaveChartGradient)"
                stroke="none"
              />
              <path
                d={leaveChart.linePath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="stat-card-gradient-subtext">30 ngày qua</p>
        </div>
      </div>

      {/* Tỷ lệ nghỉ việc */}
      <div className="stat-card-gradient red">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content ratio-card">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Tỷ lệ nghỉ việc</p>
            <p className="stat-card-gradient-value-ratio">{resignRatio}%</p>
          </div>
          <div className="stat-card-chart-container">
            <svg className="stat-card-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="resignChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)" />
                  <stop offset="100%" stopColor="rgba(239, 68, 68, 0.02)" />
                </linearGradient>
              </defs>
              <path
                d={resignChart.areaPath}
                fill="url(#resignChartGradient)"
                stroke="none"
              />
              <path
                d={resignChart.linePath}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="stat-card-gradient-subtext">{statistics?.approvedResign || 0} đơn đã duyệt</p>
        </div>
      </div>

      {/* Đơn tăng ca */}
      <div className="stat-card-gradient yellow">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Đơn tăng ca</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.donTangCa || 0}</p>
          <p className="stat-card-gradient-subtext">Đơn gửi tới</p>
        </div>
      </div>

      {/* Đơn bổ sung công */}
      <div className="stat-card-gradient slate">
        <div className="stat-card-gradient-bg-decoration"></div>
        <div className="stat-card-gradient-content">
          <div className="stat-card-gradient-header">
            <p className="stat-card-gradient-label">Đơn bổ sung công</p>
            <svg className="stat-card-gradient-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p className="stat-card-gradient-value">{statistics?.donChamCong || 0}</p>
          <p className="stat-card-gradient-subtext">Theo dõi bổ sung giờ</p>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCards;
