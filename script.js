const API_URL = "https://dev.uvfotoevideo.com.br/api";
let selectedImages = [];
let imageMap = {};
let isProcessing = false;
let isLoadingAlbums = false;

// Função genérica para requisições à API com melhor tratamento de erros
async function apiRequest(endpoint, options = {}) {
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

// Carrega álbuns com otimização e define as capas
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
    // Busca a lista de álbuns
    const data = await apiRequest("/main/folders");
    console.log("Álbuns retornados pela API:", data.folders);

    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
      return;
    }

    // Filtra o álbum FotosCapas para que ele não seja exibido
    const filteredAlbums = data.folders.filter(album => 
      album.name.trim().toLowerCase() !== "fotoscapas"
    );
    console.log("Álbuns filtrados (sem FotosCapas):", filteredAlbums);

    // Usa /images em vez de /process-images para capas
    let fotosCapas = [];
    try {
      const capasData = await apiRequest("/albums/1w3_3QJ0AMf-K6wqNHJPw4d5aWDekHTvN/images");
      fotosCapas = capasData.images || [];
      console.log("Imagens de capa carregadas:", fotosCapas);
    } catch (error) {
      console.error("Erro ao carregar imagens de capa:", error);
    }

    const fragment = document.createDocumentFragment();
    filteredAlbums.forEach(album => {
      console.log(`Processando álbum: ${album.name}`);

      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");

      // Busca a imagem de capa correspondente
      const fotoCapa = fotosCapas.find(img => {
        const lowerAlbumName = album.name.trim().toLowerCase();
        const lowerImageName = img.name.trim().toLowerCase().replace(/\.(jpg|jpeg|png)$/, "");
        console.log(`Comparando álbum "${lowerAlbumName}" com imagem "${lowerImageName}"`);
        return lowerAlbumName === lowerImageName;
      });

      // Usa public_url se disponível
      const capaUrl = fotoCapa
        ? (fotoCapa.public_url || `https://drive.google.com/thumbnail?id=${fotoCapa.id}`)
        : "https://placehold.co/300x200?text=Sem+Capa";

      albumCard.innerHTML = `
        <img 
          src="${capaUrl}" 
          alt="Capa do Álbum" 
          style="border-radius: 5px; width: 100%; height: 200px; object-fit: cover; transition: transform 0.3s;"
        >
        <h3>${album.name}</h3>
      `;
      albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;
      fragment.appendChild(albumCard);
    });

    albumContainer.innerHTML = "";
    albumContainer.appendChild(fragment);
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

// Carrega imagens normais (sem indexação)
async function refreshAlbum(albumId) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) {
    console.error("Elemento 'image-gallery' não encontrado.");
    return;
  }

  // Mostra loader com mensagem específica
  gallery.innerHTML = `
    <div class="loading-container">
      <div class="loader"></div>
      <p class="loading-message">Carregando suas fotos...</p>
    </div>
  `;

  try {
    // Usa /images em vez de /process-images
    const data = await apiRequest(`/albums/${albumId}/images?page_size=1000`);

    // Verifica se a resposta trouxe imagens
    if (!Array.isArray(data.images) || data.images.length === 0) {
      gallery.innerHTML = "<p>Nenhuma imagem disponível neste álbum.</p>";
      return;
    }

    // Cria os elementos das imagens
    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      
      // Usa public_url se disponível
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
      fragment.appendChild(container);
    });

    gallery.innerHTML = "";
    gallery.appendChild(fragment);
    console.log("Imagens carregadas:", data.images.length);
  } catch (error) {
    console.error("Erro ao carregar as imagens:", error);
    gallery.innerHTML = `
      <div class="error-container">
        <p>Erro ao carregar as imagens do álbum</p>
        <button onclick="refreshAlbum('${albumId}')" class="retry-btn">
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

// Nova função de reconhecimento facial
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

    // Nova rota /upload-selfie com parâmetros
    const data = await apiRequest(`/albums/${albumId}/upload-selfie?threshold=85&max_faces=20`, {
      method: "POST",
      body: formData,
    });

    console.log("Resposta do reconhecimento:", data);

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

    // Remove a mensagem e limpa a galeria para mostrar apenas as imagens
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

// Exibe correspondências com confidence
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  const fragment = document.createDocumentFragment();
  
  matches.forEach((match, index) => {
    const container = document.createElement("div");
    container.classList.add("photo-container", "match-result");
    
    // Adiciona informação de confiança se disponível
    const confidence = match.confidence ? `${Math.round(match.confidence)}%` : '';
    
    // Usa public_url se disponível
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
    
    fragment.appendChild(container);
  });

  gallery.appendChild(fragment);
}

// Controles de seleção
document.addEventListener("DOMContentLoaded", function() {
  // Deselecionar todas
  const deselectBtn = document.getElementById("deselect-all-btn");
  if (deselectBtn) {
    deselectBtn.addEventListener("click", () => {
      const containers = document.querySelectorAll(".photo-container");
      selectedImages = [];
      containers.forEach(container => {
        container.classList.remove("selected");
      });
      console.log("Todas desmarcadas:", selectedImages);
    });
  }

  // Selecionar todas
  const selectBtn = document.getElementById("select-all-btn");
  if (selectBtn) {
    selectBtn.addEventListener("click", () => {
      const containers = document.querySelectorAll(".photo-container");
      selectedImages = [];
      containers.forEach(container => {
        if (!container.classList.contains("selected")) {
          container.classList.add("selected");
          const img = container.querySelector("img");
          const imageId = img.dataset.imageId || extractImageId(img.src);
          if (imageId) {
            selectedImages.push(imageId);
          }
        }
      });
      console.log("Selecionadas todas:", selectedImages);
    });
  }

  // Download selecionadas
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
});

// Função auxiliar para extrair ID da imagem
function extractImageId(url) {
  const idMatch = url.match(/id=([^&]+)/);
  return idMatch ? idMatch[1] : null;
}

// Função para baixar imagens selecionadas
async function downloadSelectedImages(selectedIds) {
  const zip = new JSZip();
  const imgFolder = zip.folder("imagens");

  for (let i = 0; i < selectedIds.length; i++) {
    const id = selectedIds[i];
    const driveUrl = `https://drive.google.com/uc?id=${id}&export=download`;
    const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl)}`;
    
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

// Sistema de cliques otimizado
document.addEventListener("click", (event) => {
  // Clique no círculo de seleção
  if (event.target.classList.contains("selection-circle")) {
    const photoContainer = event.target.closest(".photo-container");
    if (photoContainer) {
      toggleSelection(photoContainer);
    }
    return;
  }

  // Clique na imagem para download
  if (event.target.tagName === "IMG" && event.target.closest(".photo-container")) {
    event.stopPropagation();
    downloadImage(event.target);
    return;
  }
});

// Função para alternar seleção
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

// Função para download individual
async function downloadImage(img) {
  const imageId = img.dataset.imageId || extractImageId(img.src);
  if (!imageId) {
    console.log("Erro: ID da imagem não encontrado");
    return;
  }

  const driveUrl = `https://drive.google.com/uc?id=${imageId}&export=download`;
  const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl)}`;

  const container = img.closest(".photo-container");
  
  // Aplica estado de loading
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

    console.log("Download concluído para a imagem:", imageId);
  } catch (error) {
    console.error("Erro durante o download:", error);
  } finally {
    // Remove estado de loading
    if (container) {
      const loaderElem = container.querySelector(".loader");
      if (loaderElem) loaderElem.remove();
      container.removeAttribute("style");
    }
    img.removeAttribute("style");
  }
}

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  const albumId = new URLSearchParams(window.location.search).get("album");

  if (albumId) {
    console.log("Página carregada dentro de um álbum");
    refreshAlbum(albumId);
  }

  // Botão de atualizar álbum
  const updateButton = document.getElementById("updateAlbumBtn");
  if (updateButton) {
    updateButton.addEventListener("click", () => {
      console.log("Botão 'Atualizar Álbum' clicado!");
      refreshAlbum(albumId);
    });
  }
});

// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;



