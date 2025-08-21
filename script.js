const API_URL = "https://dev.uvfotoevideo.com.br/api";
let selectedImages = [];
let isLoadingMore = false;
let currentPageToken = null;
const PAGE_SIZE = 200;

// --- FLAG DE BLOQUEIO DEFINITIVA ---
let isRecognitionRunning = false;

// Função genérica para requisições à API
async function apiRequest(endpoint, options = {} ) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('Requisição cancelada por timeout');
    console.error(`Erro na requisição para ${endpoint}:`, error);
    throw error;
  }
}

// Verifica se o conteúdo preenche a tela. Se não, carrega mais.
async function checkAndLoadMore(albumId) {
    // BLOQUEIA a função se o reconhecimento estiver em andamento
    if (isRecognitionRunning || isLoadingMore || !currentPageToken) {
        return;
    }
    
    const hasScrollbar = document.body.scrollHeight > document.body.clientHeight;
    if (!hasScrollbar) {
        console.log("A tela não está cheia. Carregando mais imagens automaticamente...");
        await loadMoreImages(albumId);
    }
}

// Limpa a galeria e inicia o carregamento da primeira página.
async function refreshAlbum(albumId) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  // Garante que a flag e o título sejam resetados
  isRecognitionRunning = false;
  const title = document.getElementById('recognition-title');
  if (title) title.style.display = 'none';

  currentPageToken = null;
  isLoadingMore = false; 
  
  gallery.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <p class="loading-message">Carregando suas fotos...</p>
    </div>
  `;

  await loadMoreImages(albumId);
}

// Carrega uma página de imagens
async function loadMoreImages(albumId) {
  if (isLoadingMore) return;
  isLoadingMore = true;

  const gallery = document.getElementById("image-gallery");
  
  let endpoint = `/albums/${albumId}/images?page_size=${PAGE_SIZE}`;
  if (currentPageToken) {
    endpoint += `&page_token=${currentPageToken}`;
  }

  const loaderId = 'loading-more-spinner';
  if (currentPageToken && !document.getElementById(loaderId)) {
      const loaderDiv = document.createElement('div');
      loaderDiv.id = loaderId;
      loaderDiv.className = 'loading-container';
      loaderDiv.innerHTML = `<div class="loader"></div><p>Carregando mais fotos...</p>`;
      gallery.appendChild(loaderDiv);
  }

  try {
    const data = await apiRequest(endpoint);
    if (!currentPageToken) gallery.innerHTML = ""; 
    if (!Array.isArray(data.images) || data.images.length === 0) {
      if (!currentPageToken) gallery.innerHTML = "<p>Nenhuma imagem disponível neste álbum.</p>";
      currentPageToken = null;
      return;
    }
    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      const imageUrl = image.public_url || `https://drive.google.com/thumbnail?id=${image.id}`;
      container.innerHTML = `<img src="${imageUrl}" alt="${image.name}" class="fade-in" data-image-id="${image.id}"><div class="selection-circle"></div>`;
      fragment.appendChild(container );
    });
    gallery.appendChild(fragment);
    currentPageToken = data.next_page_token || null;
  } catch (error) {
    console.error("Erro ao carregar as imagens:", error);
    if (!currentPageToken) {
        gallery.innerHTML = `<div class="error-container"><p>Erro ao carregar as imagens do álbum</p><button onclick="refreshAlbum('${albumId}')" class="retry-btn">Tentar Novamente</button></div>`;
    }
  } finally {
    const loaderDiv = document.getElementById(loaderId);
    if (loaderDiv) loaderDiv.remove();
    isLoadingMore = false;
    await checkAndLoadMore(albumId);
  }
}

// Função de reconhecimento facial
async function uploadSelfie(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById("fileInput");
  const file = fileInput?.files[0];
  if (!file) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const albumId = new URLSearchParams(window.location.search).get("album");
  if (!albumId) return;

  // --- PONTO CRÍTICO: ATIVA O BLOQUEIO ---
  isRecognitionRunning = true;

  const gallery = document.getElementById("image-gallery");
  gallery.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Analisando sua foto e buscando correspondências...</p></div>`;
  
  const title = document.getElementById('recognition-title');
  if (title) title.style.display = 'none';

  try {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiRequest(`/albums/${albumId}/upload-selfie?threshold=85&max_faces=20`, { method: "POST", body: formData });

    if (!data.matches || data.matches.length === 0) {
      gallery.innerHTML = `<div class="no-matches"><p>Nenhuma correspondência encontrada.</p><p>Tente com uma foto mais clara do seu rosto.</p><button onclick="refreshAlbum('${albumId}')" class="retry-btn">Ver todas as fotos do álbum</button></div>`;
    } else {
      gallery.innerHTML = "";
      displayMatchingImages(data.matches);
    }
  } catch (error) {
    console.error("Erro ao processar sua imagem:", error);
    gallery.innerHTML = `<div class="error-container"><p>Erro ao processar sua imagem.</p><p>Verifique se o álbum foi indexado ou tente novamente.</p><button onclick="refreshAlbum('${albumId}')" class="retry-btn">Ver todas as fotos</button></div>`;
  } finally {
    // --- PONTO CRÍTICO: DESATIVA O BLOQUEIO ---
    isRecognitionRunning = false;
  }
}

// Exibe os resultados do reconhecimento facial
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;
  const title = document.getElementById('recognition-title');
  if (title) title.style.display = 'block';
  const fragment = document.createDocumentFragment();
  matches.forEach((match, index) => {
    const container = document.createElement("div");
    container.classList.add("photo-container", "match-result");
    const confidence = match.confidence ? `${Math.round(match.confidence)}%` : '';
    const imageUrl = match.public_url || `https://drive.google.com/thumbnail?id=${match.image_id}`;
    container.innerHTML = `<img src="${imageUrl}" alt="Foto encontrada ${index + 1}" class="fade-in" data-image-id="${match.image_id}"><div class="selection-circle"></div>${confidence ? `<div class="confidence-badge">${confidence}</div>` : ''}`;
    fragment.appendChild(container );
  });
  gallery.appendChild(fragment);
}

// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener("DOMContentLoaded", function () {
  const albumId = new URLSearchParams(window.location.search).get("album");
  if (albumId) {
    refreshAlbum(albumId);
  }

  // Evento de scroll
  window.addEventListener('scroll', () => {
    // BLOQUEIA a função se o reconhecimento estiver em andamento
    if (isRecognitionRunning || isLoadingMore || !currentPageToken) {
        return;
    }
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        console.log("Fim da página alcançado, carregando mais imagens...");
        loadMoreImages(albumId);
    }
  });
  
  // (O resto do código, com as funções de seleção, download, etc., permanece igual)
  // ...
});

// (As funções de utilidade como downloadSelectedImages, toggleSelection, etc. não precisam de alteração)
// ... cole o resto do seu script aqui ...
function extractImageId(url) {
  const idMatch = url.match(/id=([^&]+)/);
  return idMatch ? idMatch[1] : null;
}
async function downloadSelectedImages(selectedIds) {
  const zip = new JSZip();
  const imgFolder = zip.folder("imagens");
  for (let i = 0; i < selectedIds.length; i++) {
    const id = selectedIds[i];
    const driveUrl = `https://drive.google.com/uc?id=${id}&export=download`;
    const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl )}`;
    try {
      const response = await fetch(proxyUrl);
      const blob = await response.blob();
      const fileName = `imagem_${i + 1}.jpg`;
      imgFolder.file(fileName, blob);
    } catch (error) {
      console.error("Erro ao baixar a imagem:", driveUrl, error);
    }
  }
  zip.generateAsync({ type: "blob" }).then(function(content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "imagens.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}
function toggleSelection(photoContainer) {
  photoContainer.classList.toggle("selected");
  const img = photoContainer.querySelector("img");
  const imageId = img.dataset.imageId || extractImageId(img.src);
  if (imageId) {
    if (photoContainer.classList.contains("selected")) {
      if (!selectedImages.includes(imageId)) {
        selectedImages.push(imageId);
      }
    } else {
      selectedImages = selectedImages.filter(id => id !== imageId);
    }
  }
}
async function downloadImage(img) {
  const imageId = img.dataset.imageId || extractImageId(img.src);
  if (!imageId) return;
  const driveUrl = `https://drive.google.com/uc?id=${imageId}&export=download`;
  const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl )}`;
  const container = img.closest(".photo-container");
  if (container) {
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";
    if (!container.querySelector(".loader")) {
      const loader = document.createElement("div");
      loader.className = "loader";
      loader.style.cssText = "position: absolute; z-index: 9;";
      container.insertBefore(loader, container.firstChild);
    }
    img.style.filter = "brightness(61%)";
  }
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Erro no download!");
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = img.alt || "imagem.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error("Erro durante o download:", error);
  } finally {
    if (container) {
      const loaderElem = container.querySelector(".loader");
      if (loaderElem) loaderElem.remove();
      container.removeAttribute("style");
    }
    img.removeAttribute("style");
  }
}
document.addEventListener("click", (event) => {
    const photoContainer = event.target.closest(".photo-container");
    if (!photoContainer) return;
    if (event.target.classList.contains("selection-circle")) {
      toggleSelection(photoContainer);
      return;
    }
    if (event.target.tagName === "IMG") {
      event.stopPropagation();
      downloadImage(event.target);
      return;
    }
});
const deselectBtn = document.getElementById("deselect-all-btn");
if (deselectBtn) {
    deselectBtn.addEventListener("click", () => {
        document.querySelectorAll(".photo-container.selected").forEach(c => c.classList.remove("selected"));
        selectedImages = [];
    });
}
const selectBtn = document.getElementById("select-all-btn");
if (selectBtn) {
    selectBtn.addEventListener("click", () => {
        selectedImages = [];
        document.querySelectorAll(".photo-container:not(.selected)").forEach(container => {
            container.classList.add("selected");
            const img = container.querySelector("img");
            const imageId = img.dataset.imageId || extractImageId(img.src);
            if (imageId) selectedImages.push(imageId);
        });
    });
}
const downloadBtn = document.getElementById("download-selected-btn");
if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
        if (selectedImages.length === 0) {
            alert("Nenhuma imagem selecionada!");
            return;
        }
        downloadSelectedImages(selectedImages);
    });
}

// Expõe funções globalmente para serem usadas no HTML (onclick)
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
