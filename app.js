// app.js
// Conexión Socket.io, inicialización de Monaco Editor, envío de contenido al iframe y inspector DOM.

const socket = io();

// Cargar Monaco desde CDN
require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.39.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
  const initialHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Mi ejercicio</title>
  <meta name="description" content="Ejemplo básico">
</head>
<body>
  <h1>Hola Mundo</h1>
  <p>Escribe tu HTML aquí y pulsa Actualizar preview.</p>
  <img src="https://via.placeholder.com/150" alt="Imagen de ejemplo">
</body>
</html>`;

  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: initialHTML,
    language: 'html',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false }
  });

  const previewIframe = document.getElementById('preview');
  const runBtn = document.getElementById('run');
  const autoRefreshCheckbox = document.getElementById('autoRefresh');
  const deviceSelect = document.getElementById('deviceSelect');
  const domInspector = document.getElementById('dom-inspector');

  // Enviar contenido al iframe mediante postMessage
  function updatePreview() {
    const html = editor.getValue();
    previewIframe.contentWindow.postMessage({ type: 'setHTML', html }, '*');
    socket.emit('updatePreview', html);
    setTimeout(updateInspector, 150);
  }

  // Guardado simple en localStorage como checkpoint
  function saveCheckpoint() {
    const checkpoints = JSON.parse(localStorage.getItem('checkpoints') || '[]');
    checkpoints.push({ html: editor.getValue(), date: new Date().toISOString() });
    localStorage.setItem('checkpoints', JSON.stringify(checkpoints));
    alert('Checkpoint guardado');
  }

  function loadCheckpoint() {
    const checkpoints = JSON.parse(localStorage.getItem('checkpoints') || '[]');
    if (!checkpoints.length) {
      alert('No hay checkpoints guardados');
      return;
    }
    const last = checkpoints[checkpoints.length - 1];
    editor.setValue(last.html);
    updatePreview();
  }

  // Recibir actualizaciones desde otros clientes
  socket.on('previewContent', html => {
    // Actualiza la preview sin tocar el editor local
    previewIframe.contentWindow.postMessage({ type: 'setHTML', html }, '*');
    setTimeout(updateInspector, 150);
  });

  // Inspector DOM simple que muestra árbol de nodos
  function updateInspector() {
    try {
      const doc = previewIframe.contentDocument || previewIframe.contentWindow.document;
      const root = doc.documentElement;
      domInspector.innerHTML = renderNode(root, 0);
    } catch (e) {
      domInspector.textContent = 'Inspector no disponible por políticas de seguridad';
    }
  }

  function renderNode(node, depth) {
    if (!node) return '';
    const indent = '&nbsp;'.repeat(depth * 2);
    let out = `${indent}&lt;<strong>${node.nodeName.toLowerCase()}</strong>&gt;<br>`;
    node.childNodes.forEach(n => {
      if (n.nodeType === 1) out += renderNode(n, depth + 1);
      else if (n.nodeType === 3 && n.textContent.trim()) out += `${indent}&nbsp;&nbsp;${escapeHtml(n.textContent.trim())}<br>`;
    });
    return out;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Eventos UI
  runBtn.addEventListener('click', updatePreview);
  document.getElementById('saveCheckpoint').addEventListener('click', saveCheckpoint);
  document.getElementById('loadCheckpoint').addEventListener('click', loadCheckpoint);
  document.getElementById('open-exercise').addEventListener('click', () => {
    // Cargar un ejercicio simple
    const exerciseHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Ejercicio 1</title></head>
<body>
  <h1>Título del ejercicio</h1>
  <p>Reemplaza este contenido por tu solución.</p>
</body>
</html>`;
    editor.setValue(exerciseHTML);
    updatePreview();
  });

  // Auto refresh al escribir si está activado (con debounce)
  let debounceTimer = null;
  editor.onDidChangeModelContent(() => {
    if (!autoRefreshCheckbox.checked) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 400);
  });

  // Cambiar tamaño del iframe según dispositivo seleccionado
  deviceSelect.addEventListener('change', () => {
    const val = deviceSelect.value;
    if (val === 'desktop') {
      previewIframe.style.width = '100%';
      previewIframe.style.height = '80vh';
    } else if (val === 'tablet') {
      previewIframe.style.width = '768px';
      previewIframe.style.height = '1024px';
    } else {
      previewIframe.style.width = '375px';
      previewIframe.style.height = '667px';
    }
  });

  // Inicializar preview
  updatePreview();
});
