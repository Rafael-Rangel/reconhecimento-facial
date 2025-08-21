const API_URL = "https://dev.uvfotoevideo.com.br/api";
let selectedImages = [];
let imageMap = {};
let isProcessing = false;
let isLoadingAlbums = false;

// --- NOVAS VARIÁVEIS PARA PAGINAÇÃO ---
let currentPageToken = null;
let isLoadingMore = false; // Controla para não carregar várias páginas ao mesmo tempo
const PAGE_SIZE = 200; // Define o tamanho da página para 200 imagens

// Função genérica para requisições à API com melhor tratamento de erros
async function apiRequest(endpoint, options = {} ) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Requisição cancelada por timeout');
    }
    
    console.error(`Erro na requisição para ${endpoint}:`, error);
    throw error;
  }
}

// Debounce para evitar múltiplas chamadas simultâneas
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Carrega álbuns com otimização e define as capas (sem alterações aqui)
async function loadAlbums() {
  if (isLoadingAlbums) return;
  isLoadingAlbums = true;

  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) {
    console.error("Elemento 'album-container' não encontrado no DOM.");
    return;
  }

  albumContainer.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <p class="loading-message">Carregando álbuns...</p>
    </div>
  `;

  try {
    const data = await apiRequest("/main/folders");
    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
      return;
    }

    const filteredAlbums = data.folders.filter(album => 
      album.name.trim().toLowerCase() !== "fotoscapas"
    );

    let fotosCapas = [];
    try {
      const capasData = await apiRequest("/albums/1w3_3QJ0AMf-K6wqNHJPw4d5aWDekHTvN/images");
      fotosCapas = capasData.images || [];
    } catch (error) {
      console.error("Erro ao carregar imagens de capa:", error);
    }

    const fragment = document.createDocumentFragment();
    filteredAlbums.forEach(album => {
      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");

      const fotoCapa = fotosCapas.find(img => {
        const lowerAlbumName = album.name.trim().toLowerCase();
        const lowerImageName = img.name.trim().toLowerCase().replace(/\.(jpg|jpeg|png)$/, "");
        return lowerAlbumName === lowerImageName;
      });

      const capaUrl = fotoCapa
        ? (fotoCapa.public_url || `https://drive.google.com/thumbnail?id=${fotoCapa.id}` )
        : "https://placehold.co/300x200?text=Sem+Capa";

      albumCard.innerHTML = `
        <img 
          src="${capaUrl}" 
          alt="Capa do Álbum" 
          style="border-radius: 5px; width: 100%; height: 200px; object-fit: cover; transition: transform 0.3s;"
        >
        <h3>${album.name}</h3>
      `;
      albumCard.onclick = ( ) => window.location.href = `album.html?album=${album.id}`;
      fragment.appendChild(albumCard);
    });

    albumContainer.innerHTML = "";
    albumContainer.appendChild(fragment);
    console.log(`loadAlbums: ${filteredAlbums.length} imagens de capa carregadas.`);
  } catch (error) {
    console.error("Erro ao carregar os álbuns:", error);
    albumContainer.innerHTML = `
      <div class="error-container">
        <p>Erro ao carregar os álbuns</p>
        <button onclick="loadAlbums()" class="retry-btn">Tentar Novamente</button>
      </div>
    `;
  } finally {
    isLoadingAlbums = false;
  }
}

// --- FUNÇÃO REFRESH ALBUM ATUALIZADA ---
// Agora ela apenas limpa a galeria e inicia o carregamento da primeira página.
async function refreshAlbum(albumId) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) {
    console.error("Elemento 'image-gallery' não encontrado.");
    return;
  }

  // Reseta o estado da paginação para um novo carregamento
  currentPageToken = null;
  isLoadingMore = false; 
  
  gallery.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <p class="loading-message">Carregando suas fotos...</p>
    </div>
  `;

  // Chama a função para carregar as imagens (a primeira página)
  await loadMoreImages(albumId);
}

// --- NOVA FUNÇÃO PARA CARREGAR IMAGENS (PAGINADO) ---
async function loadMoreImages(albumId) {
  if (isLoadingMore) return; // Previne carregamentos simultâneos
  isLoadingMore = true;

  const gallery = document.getElementById("image-gallery");
  
  // Constrói a URL da API com os parâmetros de paginação
  let endpoint = `/albums/${albumId}/images?page_size=${PAGE_SIZE}`;
  if (currentPageToken) {
    endpoint += `&page_token=${currentPageToken}`;
  }

  // Adiciona um loader no final da galeria se não for a primeira carga
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

    // Se for a primeira carga, limpa o loader inicial
    if (!currentPageToken) {
      gallery.innerHTML = ""; 
    }

    if (!Array.isArray(data.images) || data.images.length === 0) {
      if (!currentPageToken) { // Só mostra mensagem se for a primeira página e não vier nada
        gallery.innerHTML = "<p>Nenhuma imagem disponível neste álbum.</p>";
      }
      currentPageToken = null; // Indica que não há mais páginas
      return;
    }

    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      
      const imageUrl = image.public_url || `https://drive.google.com/thumbnail?id=${image.id}`;
      
      container.innerHTML = `
        <img 
          src="${imageUrl}" 
          alt="${image.name}" 
          class="fade-in"
          data-image-id="${image.id}"
        >
        <div class="selection-circle"></div>
      `;
      fragment.appendChild(container );
    });

    gallery.appendChild(fragment);
    console.log(`loadMoreImages: ${data.images.length} imagens carregadas.`);
    
    // Atualiza o token para a próxima requisição. Se não vier, será null.
    currentPageToken = data.next_page_token || null;

  } catch (error) {
    console.error("Erro ao carregar as imagens:", error);
    if (!currentPageToken) { // Só mostra erro se falhar na primeira página
        gallery.innerHTML = `
          <div class="error-container">
            <p>Erro ao carregar as imagens do álbum</p>
            <button onclick="refreshAlbum('${albumId}')" class="retry-btn">Tentar Novamente</button>
          </div>
        `;
    }
  } finally {
    // Remove o loader de "carregando mais"
    const loaderDiv = document.getElementById(loaderId);
    if (loaderDiv) {
        loaderDiv.remove();
    }
    isLoadingMore = false; // Libera para a próxima requisição
  }
}


// Nova função de reconhecimento facial (sem alterações aqui)
async function uploadSelfie(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById("fileInput");
  const cameraInput = document.getElementById("cameraInput");
  const file = cameraInput?.files[0] || fileInput?.files[0];

  if (!file) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const albumId = new URLSearchParams(window.location.search).get("album");
  if (!albumId) {
    console.error("Nenhum albumId encontrado!");
    return;
  }

  const gallery = document.getElementById("image-gallery");
  gallery.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <p class="loading-message">Analisando sua foto e buscando correspondências...</p>
    </div>
  `;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiRequest(`/albums/${albumId}/upload-selfie?threshold=85&max_faces=20`, {
      method: "POST",
      body: formData,
    });

    if (!data.matches || data.matches.length === 0) {
      gallery.innerHTML = `
        <div class="no-matches">
          <p>Nenhuma correspondência encontrada</p>
          <p>Tente com uma foto mais clara do seu rosto</p>
          <button onclick="refreshAlbum('${albumId}')" style="border-color: #E01F34;box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .13);cursor: pointer;margin-top: 5px;" class="retry-btn">
            Ver todas as fotos do álbum
          </button>
        </div>
      `;
      return;
    }

    gallery.innerHTML = "";
    displayMatchingImages(data.matches);
  } catch (error) {
    console.error("Erro ao processar sua imagem:", error);
    gallery.innerHTML = `
      <div class="error-container">
        <p>Erro ao processar sua imagem</p>
        <p>Verifique se o álbum foi indexado ou tente novamente</p>
        <button onclick="refreshAlbum('${albumId}')" class="retry-btn">
          Ver todas as fotos
        </button>
      </div>
    `;
  }
}

// Exibe correspondências com confidence (sem alterações aqui)
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  const fragment = document.createDocumentFragment();
  
  matches.forEach((match, index) => {
    const container = document.createElement("div");
    container.classList.add("photo-container", "match-result");
    
    const confidence = match.confidence ? `${Math.round(match.confidence)}%` : '';
    const imageUrl = match.public_url || `https://drive.google.com/thumbnail?id=${match.image_id}`;
    
    container.innerHTML = `
      <img 
        src="${imageUrl}" 
        alt="Foto encontrada ${index + 1}" 
        class="fade-in"
        data-image-id="${match.image_id}"
      >
      <div class="selection-circle"></div>
      ${confidence ? `<div class="confidence-badge">${confidence}</div>` : ''}
    `;
    
    fragment.appendChild(container );
  });

  gallery.appendChild(fragment);
  console.log(`displayMatchingImages: ${matches.length} imagens correspondentes exibidas.`);
}

// Função auxiliar para extrair ID da imagem
function extractImageId(url) {
  const idMatch = url.match(/id=([^&]+)/);
  return idMatch ? idMatch[1] : null;
}

// Função para baixar imagens selecionadas (sem alterações aqui)
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

// Função para alternar seleção (sem alterações aqui)
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

  console.log("Estado atual das imagens selecionadas:", selectedImages);
}

// Função para download individual (sem alterações aqui)
async function downloadImage(img) {
  const imageId = img.dataset.imageId || extractImageId(img.src);
  if (!imageId) {
    console.log("Erro: ID da imagem não encontrado");
    return;
  }

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

// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener("DOMContentLoaded", function () {
  const albumId = new URLSearchParams(window.location.search).get("album");

  if (albumId) {
    console.log("Página carregada. Iniciando carregamento do álbum.");
    refreshAlbum(albumId);
  }

  // --- EVENTO DE SCROLL PARA PAGINAÇÃO INFINITA ---
  window.addEventListener('scroll', () => {
    // Condições para carregar mais:
    // 1. Não estar carregando algo no momento (isLoadingMore).
    // 2. Ter um token para a próxima página (currentPageToken).
    // 3. O usuário ter rolado até perto do final da página (offsetHeight - 500px).
    if (!isLoadingMore && currentPageToken && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        console.log("Fim da página alcançado, carregando mais imagens...");
        loadMoreImages(albumId);
    }
  });

  // Botão de atualizar álbum
  const updateButton = document.getElementById("updateAlbumBtn");
  if (updateButton) {
    updateButton.addEventListener("click", () => {
      if (albumId) {
        console.log("Botão 'Atualizar Álbum' clicado!");
        refreshAlbum(albumId);
      }
    });
  }
  
  // Controles de seleção
  const deselectBtn = document.getElementById("deselect-all-btn");
  if (deselectBtn) {
    deselectBtn.addEventListener("click", () => {
      document.querySelectorAll(".photo-container.selected").forEach(c => c.classList.remove("selected"));
      selectedImages = [];
      console.log("Todas desmarcadas:", selectedImages);
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
      console.log("Selecionadas todas:", selectedImages);
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
  
  // Sistema de cliques otimizado
  document.addEventListener("click", (event) => {
    const photoContainer = event.target.closest(".photo-container");
    if (!photoContainer) return;

    // Clique no círculo de seleção
    if (event.target.classList.contains("selection-circle")) {
      toggleSelection(photoContainer);
      return;
    }

    // Clique na imagem para download
    if (event.target.tagName === "IMG") {
      event.stopPropagation();
      downloadImage(event.target);
      return;
    }
  });
});

// Expõe funções globalmente para serem usadas no HTML (onclick)
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
