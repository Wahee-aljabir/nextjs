document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const errorDiv = document.getElementById('stats-error');

  // Fetch and display total users and active users today (with usernames)
  async function fetchUserStats() {
    try {
      const [totalRes, activeRes] = await Promise.all([
        fetch('/stats/total-users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/stats/active-users-today', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (!totalRes.ok) throw new Error('Failed to fetch total users');
      if (!activeRes.ok) throw new Error('Failed to fetch active users');
      const totalData = await totalRes.json();
      const activeData = await activeRes.json();

      let statsDiv = document.getElementById('user-stats');
      if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'user-stats';
        statsDiv.className = 'flex flex-col items-center mb-6';
        // Insert at the top of the stats card
        const card = document.querySelector('.max-w-2xl');
        card.insertBefore(statsDiv, card.children[1]);
      }

      // Rectangle bar visualization
      const total = totalData.count;
      const active = activeData.count;
      const percent = total > 0 ? (active / total) * 100 : 0;

      statsDiv.innerHTML = `
        <div class="w-full max-w-xl mb-2">
          <div style="position: relative; height: 40px; background: #d1fae5; border-radius: 8px; border: 2px solid #059669;">
            <div style="
              position: absolute;
              left: 0; top: 0; bottom: 0;
              width: ${percent}%;
              background: #2563eb;
              border-radius: 8px 0 0 8px;
              display: flex; align-items: center; justify-content: center;
              color: white; font-weight: bold;
              transition: width 0.5s;
            ">
              ${active} Active
            </div>
            <div style="
              position: absolute;
              right: 10px; top: 0; bottom: 0;
              display: flex; align-items: center; color: #059669; font-weight: bold;
            ">
              ${total} Total
            </div>
          </div>
          <div class="flex gap-4 mt-2 text-sm">
            <span class="flex items-center"><span style="display:inline-block;width:16px;height:16px;background:#2563eb;border-radius:3px;margin-right:4px"></span>Active Users</span>
            <span class="flex items-center"><span style="display:inline-block;width:16px;height:16px;background:#d1fae5;border-radius:3px;margin-right:4px;border:1px solid #059669"></span>Total Users</span>
          </div>
        </div>
        <div class="w-full max-w-xl mt-2">
          <div class="font-semibold text-emerald-900 mb-1">Active Users Today:</div>
          <div class="flex flex-wrap gap-2">
            ${activeData.usernames.map(u => `<span class="bg-blue-100 text-blue-900 px-2 py-1 rounded">${u}</span>`).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      // Optionally show error
    }
  }

  // Fetch and display hourly stats (6am-12pm)
  async function fetchHourlyStats() {
    try {
      const response = await fetch('/stats/messages-by-hour-today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch hourly stats');
      const data = await response.json();

      let gridDiv = document.getElementById('hourly-stats-grid');
      if (!gridDiv) {
        gridDiv = document.createElement('div');
        gridDiv.id = 'hourly-stats-grid';
        gridDiv.className = 'w-full max-w-xl mx-auto mt-6';
        // Insert after user stats
        const card = document.querySelector('.max-w-2xl');
        card.insertBefore(gridDiv, card.children[2]);
      }

      // Find the max count for scaling
      const maxCount = Math.max(...data.map(d => d.count), 1);

      gridDiv.innerHTML = `
        <div class="font-semibold text-emerald-900 mb-1 text-sm">Messages by Hour (Today, 9am-9pm):</div>
        <div class="flex flex-row items-end justify-between gap-2" style="min-height: 90px;">
          ${data.map(d => {
            // 9-11 => 9am-11am, 12 => 12pm, 13-21 => 1pm-9pm
            let hourNum = parseInt(d.hour);
            let hourLabel = '';
            if (hourNum === 12) {
              hourLabel = '12pm';
            } else if (hourNum > 12) {
              hourLabel = (hourNum - 12) + 'pm';
            } else {
              hourLabel = hourNum + 'am';
            }
            const barHeight = d.count > 0 ? Math.max(10, d.count / maxCount * 60) : 8;
            const barColor = d.count > 0 ? '#2563eb' : '#e5e7eb';
            const barContent = d.count > 0 ? `<span style="font-size:10px;color:white;">${d.count}</span>` : '';
            return `
              <div class="flex flex-col items-center" style="width: 32px;">
                <div style="height:70px;display:flex;align-items:flex-end;">
                  <div style="
                    width: 16px;
                    height: ${barHeight}px;
                    background: ${barColor};
                    border-radius: 3px 3px 0 0;
                    display: flex; align-items: flex-end; justify-content: center;
                    transition: height 0.5s;
                  ">
                    ${barContent}
                  </div>
                </div>
                <div class="text-xs mt-1">${hourLabel}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="flex gap-2 mt-1 text-xs text-gray-500">
          <span><span style="display:inline-block;width:12px;height:12px;background:#2563eb;border-radius:2px;margin-right:3px"></span>Messages</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#e5e7eb;border-radius:2px;margin-right:3px"></span>No messages</span>
        </div>
      `;
    } catch (err) {
      // Optionally show error
    }
  }

  // Fetch and display rooms by popularity
  async function fetchRoomsByPopularity() {
    try {
      const response = await fetch('/stats/rooms-by-popularity', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch rooms by popularity');
      const data = await response.json();

      let roomsDiv = document.getElementById('rooms-popularity-list');
      if (!roomsDiv) {
        roomsDiv = document.createElement('div');
        roomsDiv.id = 'rooms-popularity-list';
        roomsDiv.className = 'w-full max-w-xl mx-auto mt-6';
        // Insert after user stats or wherever appropriate
        const card = document.querySelector('.max-w-2xl');
        card.insertBefore(roomsDiv, card.children[2]);
      }

      roomsDiv.innerHTML = `
        <div class="font-semibold text-emerald-900 mb-2 text-base">
          Rooms by Popularity (Total Rooms: ${data.total})
        </div>
        <ol class="list-decimal pl-5">
          ${data.rooms.map((room, idx) => `
            <li class="mb-1">
              <span class="font-bold">${room.name}</span>
              <span class="text-gray-500">(${room.message_count} messages)</span>
              <span class="text-xs text-gray-400 ml-2">Owner: ${room.owner}</span>
              ${idx === 0 ? '<span class="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs">Most Popular</span>' : ''}
            </li>
          `).join('')}
        </ol>
      `;
    } catch (err) {
      // Optionally show error
    }
  }

  // Fetch and display Messages Per Room (Bar Chart) with star for most popular
  async function fetchMessagesPerRoomBarChart() {
    try {
      const response = await fetch('/stats/messages-per-room', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch messages per room');
      const data = await response.json();

      // Prepare data for Chart.js
      const labels = data.map(r => r.name);
      const counts = data.map(r => r.message_count);

      // Remove old chart if exists
      if (messagesPerRoomChart) {
        messagesPerRoomChart.destroy();
        messagesPerRoomChart = null;
      }
      let barCanvas = document.getElementById('messagesPerRoomBar');
      if (barCanvas) barCanvas.remove();

      // Create canvas
      barCanvas = document.createElement('canvas');
      barCanvas.id = 'messagesPerRoomBar';
      barCanvas.height = 60 + labels.length * 30;
      // Insert after rooms popularity list or wherever appropriate
      const card = document.querySelector('.max-w-2xl');
      let afterDiv = document.getElementById('rooms-popularity-list');
      if (afterDiv && afterDiv.nextSibling) {
        card.insertBefore(barCanvas, afterDiv.nextSibling);
      } else {
        card.appendChild(barCanvas);
      }

      // Draw bar chart
      messagesPerRoomChart = new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Messages per Room',
            data: counts,
            backgroundColor: labels.map((_, i) => i === 0 ? '#facc15' : '#2563eb'), // Most popular is yellow
            borderColor: labels.map((_, i) => i === 0 ? '#eab308' : '#2563eb'),
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
          },
          scales: {
            x: { title: { display: true, text: 'Messages' }, beginAtZero: true },
            y: { title: { display: false } }
          },
          animation: {
            onComplete: function() {
              // Draw a star above the most popular bar
              const chartInstance = this.chart;
              const ctx = chartInstance.ctx;
              const meta = chartInstance.getDatasetMeta(0);
              if (meta.data.length > 0) {
                const bar = meta.data[0];
                const { x, y } = bar.getCenterPoint();
                // Draw star
                ctx.save();
                ctx.fillStyle = '#facc15';
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const r = 12;
                for (let i = 0; i < 5; i++) {
                  ctx.lineTo(
                    x + r * Math.cos((18 + i * 72) * Math.PI / 180),
                    y - 24 + r * Math.sin((18 + i * 72) * Math.PI / 180)
                  );
                  ctx.lineTo(
                    x + (r / 2) * Math.cos((54 + i * 72) * Math.PI / 180),
                    y - 24 + (r / 2) * Math.sin((54 + i * 72) * Math.PI / 180)
                  );
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }
      });
    } catch (err) {
      // Optionally show error
    }
  }

  await fetchUserStats();
  await fetchRoomsByPopularity();
  await fetchMessagesPerRoomBarChart();
  await fetchHourlyStats();
  try {
    const response = await fetch('/stats/messages-per-day', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();

    // Prepare data for Chart.js
    const labels = data.map(item => item.date);
    const counts = data.map(item => item.count);

    // Before creating the Chart, check if the canvas exists and has a context
    const chartCanvas = document.getElementById('messagesChart');
    if (chartCanvas) {
      const ctx = chartCanvas.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Messages Sent',
              data: counts,
              borderColor: '#059669',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { title: { display: true, text: 'Date' } },
              y: { title: { display: true, text: 'Messages' }, beginAtZero: true }
            }
          }
        });
      } else {
        console.error('Canvas context is not available.');
      }
    } else {
      console.error('Canvas element #messagesChart not found.');
    }
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
  }

  // Fetch and display today's message count as a bar chart
  async function fetchTodayCount() {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/stats/messages-today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch today\'s message count');
      const data = await response.json();

      // Remove old chart if exists
      let barCanvas = document.getElementById('todayMessagesBar');
      if (barCanvas) {
        barCanvas.remove();
      }
      // Create canvas if not exists
      barCanvas = document.createElement('canvas');
      barCanvas.id = 'todayMessagesBar';
      barCanvas.height = 80;
      // Insert below the line chart
      const chartContainer = document.getElementById('messagesChart').parentNode;
      chartContainer.insertBefore(barCanvas, document.getElementById('today-messages-count'));

      // Draw bar chart
      new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Today'],
          datasets: [{
            label: 'Messages sent today',
            data: [data.count],
            backgroundColor: '#059669'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { title: { display: false } },
            y: { title: { display: true, text: 'Messages' }, beginAtZero: true, precision: 0 }
          }
        }
      });

      // Optionally, update the text stat as well
      let statDiv = document.getElementById('today-messages-count');
      if (!statDiv) {
        statDiv = document.createElement('div');
        statDiv.id = 'today-messages-count';
        statDiv.className = 'text-center text-lg font-semibold mt-6';
        chartContainer.appendChild(statDiv);
      }
      statDiv.textContent = `Messages sent today: ${data.count}`;
    } catch (err) {
      // Optionally show error
    }
  }

  // Call the function directly here
  await fetchTodayCount();
});