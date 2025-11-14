document.addEventListener('DOMContentLoaded', () => {

  // --- Seletores do DOM (Formulário Principal) ---
  const epiForm = document.getElementById('epi-form');
  const employeeInput = document.getElementById('employee');
  const employeeIdInput = document.getElementById('employee-id');
  const epiNameInput = document.getElementById('epi-name');
  const quantityInput = document.getElementById('quantity');
  const actionSelect = document.getElementById('action');
  const clearBtn = document.getElementById('clear-btn');
  
  // --- Seletores do DOM (Lista de Registros) ---
  const recordsList = document.getElementById('records');
  const searchInput = document.getElementById('search');
  const exportTransactionsBtn = document.getElementById('export-transactions-btn'); // Botão antigo
  const exportBalanceBtn = document.getElementById('export-balance-btn'); // Botão novo
  const clearAllBtn = document.getElementById('clear-all');
  const toast = document.getElementById('toast');

  // --- Seletores do DOM (Novo Modal de Balanço) ---
  const exportModal = document.getElementById('export-modal');
  const exportBalanceForm = document.getElementById('export-balance-form');
  const exportDateInput = document.getElementById('export-date');
  const exportEpiNameInput = document.getElementById('export-epi-name');
  const exportSaldoAnteriorInput = document.getElementById('export-saldo-anterior');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  // --- Banco de Dados Local (LocalStorage) ---
  let db = JSON.parse(localStorage.getItem('epi-records')) || [];

  const saveToStorage = () => {
    localStorage.setItem('epi-records', JSON.stringify(db));
  };

  // --- Renderização ---
  const renderRecords = (recordsToRender = db) => {
    recordsList.innerHTML = '';
    
    if (recordsToRender.length === 0) {
      recordsList.innerHTML = '<li>Nenhum registro encontrado.</li>';
      return;
    }

    // Ordena por data mais recente primeiro
    const sortedRecords = [...recordsToRender].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedRecords.forEach(record => {
      const li = document.createElement('li');
      
      const date = new Date(record.timestamp);
      const formattedDate = date.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });

      li.innerHTML = `
        <div class="info">
          <strong>${record.epiName}</strong>
          <small>${record.employee} ${record.employeeId ? `(${record.employeeId})` : ''}</small>
        </div>
        <div class="details">
          <div class="date">${formattedDate}</div>
          <span class="action ${record.action}">
            ${record.action === 'saida' ? 'Saída' : 'Entrada'}: ${record.quantity}
          </span>
        </div>
      `;
      recordsList.appendChild(li);
    });
  };

  // --- Funções Auxiliares ---
  const showToast = (message) => {
    toast.textContent = message;
    toast.removeAttribute('hidden');
    setTimeout(() => {
      toast.setAttribute('hidden', '');
    }, 3000);
  };

  const clearForm = () => {
    epiForm.reset();
    employeeInput.focus();
  };
  
  // Função helper para baixar o CSV
  const downloadCSV = (csvContent, fileName) => {
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Event Handlers (Formulário Principal) ---
  
  // Registrar novo item
  epiForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      employee: employeeInput.value.trim(),
      employeeId: employeeIdInput.value.trim(),
      epiName: epiNameInput.value.trim(),
      quantity: parseInt(quantityInput.value, 10),
      action: actionSelect.value,
    };

    db.unshift(newRecord); // Adiciona no início
    saveToStorage();
    renderRecords(db);
    clearForm();
    showToast('Registro salvo com sucesso!');
  });

  // Limpar formulário
  clearBtn.addEventListener('click', clearForm);

  // --- Event Handlers (Controles da Lista) ---

  // Pesquisar
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
      renderRecords(db);
      return;
    }

    const filtered = db.filter(r => 
      r.employee.toLowerCase().includes(searchTerm) ||
      r.epiName.toLowerCase().includes(searchTerm) ||
      r.action.toLowerCase().includes(searchTerm) ||
      (r.employeeId && r.employeeId.toLowerCase().includes(searchTerm))
    );
    renderRecords(filtered);
  });

  // Exportar Log de Transações (Botão antigo)
  exportTransactionsBtn.addEventListener('click', () => {
    if (db.length === 0) {
      showToast('Não há dados para exportar.');
      return;
    }

    let csvContent = "Data e Hora,Colaborador,Matricula,EPI,Quantidade,Acao\r\n";
    // Ordena por data para exportar
    const sortedDb = [...db].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sortedDb.forEach(record => {
      const date = new Date(record.timestamp).toLocaleString('pt-BR');
      const row = [
        `"${date}"`,
        `"${record.employee}"`,
        `"${record.employeeId}"`,
        `"${record.epiName}"`,
        record.quantity,
        `"${record.action}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    downloadCSV(csvContent, 'log_transacoes_epis_agrovale.csv');
  });

  // Apagar todos os registros
  clearAllBtn.addEventListener('click', () => {
    if (db.length === 0) return;

    if (confirm('Tem certeza que deseja apagar TODOS os registros? Esta ação não pode ser desfeita.')) {
      db = [];
      saveToStorage();
      renderRecords(db);
      showToast('Todos os registros foram apagados.');
    }
  });


  // --- NOVA LÓGICA DE BALANÇO (MODAL) ---

  // Abrir o modal
  exportBalanceBtn.addEventListener('click', () => {
    // Sugere a data de hoje
    exportDateInput.value = new Date().toISOString().split('T')[0];
    exportModal.showModal();
  });

  // Fechar o modal
  modalCancelBtn.addEventListener('click', () => {
    exportModal.close();
  });
  
  // Lógica principal de cálculo e exportação do balanço
  const handleBalanceExport = (e) => {
    e.preventDefault();
    
    // 1. Obter dados do formulário do modal
    const targetDateStr_ISO = exportDateInput.value; // Formato "YYYY-MM-DD"
    const targetEpiName = exportEpiNameInput.value.trim().toLowerCase();
    const saldoAnterior = parseInt(exportSaldoAnteriorInput.value, 10);

    if (targetEpiName === '') {
        showToast('Por favor, informe o nome do EPI.');
        return;
    }
    
    // Precisamos comparar datas ignorando fuso horário, pegando "dia" local
    const targetDate = new Date(targetDateStr_ISO + 'T00:00:00'); // Define hora 00:00 no fuso local
    const targetDateString = targetDate.toDateString(); // Ex: "Fri Nov 14 2025"

    // 2. Calcular totais do dia
    let totalEntradas = 0;
    let totalSaidas = 0;

    db.forEach(record => {
      // Compara o "dia" (ignorando hora) e o nome do EPI
      const recordDate = new Date(record.timestamp);
      const recordDateString = recordDate.toDateString();

      if (record.epiName.trim().toLowerCase() === targetEpiName && recordDateString === targetDateString) {
        if (record.action === 'entrada') {
          totalEntradas += record.quantity;
        } else if (record.action === 'saida') {
          totalSaidas += record.quantity;
        }
      }
    });
    
    // 3. Calcular saldo total
    const saldoTotal = saldoAnterior + totalEntradas - totalSaidas;

    // 4. Gerar o CSV
    let csvContent = "EPI,Data,Saldo Anterior,Total Entradas,Total Saidas,Saldo Total\r\n";
    
    const formattedDateForCSV = targetDate.toLocaleDateString('pt-BR'); // Formato "DD/MM/YYYY"
    const epiNameOriginal = exportEpiNameInput.value.trim(); // Pega nome com maiúsculas
    
    const row = [
        `"${epiNameOriginal}"`,
        `"${formattedDateForCSV}"`,
        saldoAnterior,
        totalEntradas,
        totalSaidas,
        saldoTotal
    ].join(",");
    
    csvContent += row + "\r\n";

    const fileName = `balanco_${epiNameOriginal.replace(/ /g, '_')}_${targetDateStr_ISO}.csv`;
    downloadCSV(csvContent, fileName);
    
    // 5. Fechar e notificar
    exportModal.close();
    exportBalanceForm.reset();
    showToast('Relatório de balanço gerado!');
  };
  
  // Associar a lógica ao submit do modal
  exportBalanceForm.addEventListener('submit', handleBalanceExport);


  // --- Inicialização ---
  renderRecords(db);
  
});
