// Constantes e configuração
const API_URL = "https://projetofotografo.zapto.org/api";
const THUMBNAIL_BASE_URL = "https://drive.google.com/thumbnail?id=";
const DOWNLOAD_BASE_URL = "https://drive.google.com/uc?id=";

// Cache e estado
const cache = {
  albums: new Map(),
  images: new Map(),
  thumbnails: new Set()
};

// Estado da aplicação
const state = {
  selectedImages: [],
  imageMap: {},
  isProcessing: false,
  isLoadingAlbums: false,
  isAlbumDeleted: false
};

// Utilitários
const utils = {
  // Debounce para evitar múltiplas chamadas
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Função para mostrar mensagens de erro/sucesso
  showMessage: (elementId, message, isError = false) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `<p style="color: ${isError ? '#e01f34' : '#2e7d32'}; width: 100%; text-align: center;">${message}</p>`;
  },
  
  // Função para mostrar/esconder loader
  toggleLoader: (elementId, show) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (show) {
      element.classList.add("loading");
      element.innerHTML = '<div class="loader"></div>';
    } else {
      element.classList.remove("loading");
      const loader = element.querySelector(".loader");
      if (loader) loader.style.display = "none";
    }
  }
};

// API - Funções de comunicação com o servidor
const api = {
  // Função para fazer requisições com cache e retry
  async fetchWithCache(url, options = {}, cacheKey = null, useCache = true) {
    // Se temos cache e podemos usá-lo, retorne o cache
    if (useCache && cacheKey && cache.albums.has(cacheKey)) {
      console.log(`Usando cache para: ${cacheKey}`);
      return cache.albums.get(cacheKey);
    }
    
    // Implementação de retry
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Salva no cache se temos uma chave
        if (cacheKey) {
          cache.albums.set(cacheKey, data);
        }
        
        return data;
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`Tentativa falhou, restam ${retries} tentativas`, error);
        
        // Espera antes de tentar novamente (backoff exponencial)
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
        }
      }
    }
    
    throw lastError;
  },
  
  // Verifica se o álbum existe
  async checkAlbum(albumId) {
    return this.fetchWithCache(
      `${API_URL}/albums/${albumId}`, 
      {}, 
      `album_${albumId}`,
      true
    );
  },
  
  // Carrega imagens do álbum
  async getAlbumImages(albumId, forceRefresh = false) {
    return this.fetchWithCache(
      `${API_URL}/albums/${albumId}/images`, 
      {}, 
      `album_images_${albumId}`,
      !forceRefresh
    );
  },
  
  // Carrega lista de álbuns
  async getAlbums() {
    return this.fetchWithCache(
      `${API_URL}/main/folders`, 
      {}, 
      'all_albums',
      false // Sempre busca álbuns frescos
    );
  },
  
  // Envia selfie para reconhecimento facial
  async uploadSelfie(albumId, file) {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(
      `${API_URL}/albums/${albumId}/upload-selfie?max_faces=4096&threshold=70`, 
      {
        method: "POST",
        body: formData
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao enviar selfie: ${response.status}`);
    }
    
    return response.json();
  }
};

// Funções principais
async function checkAndLoadAlbum(albumId) {
  if (!albumId) {
    console.warn("⚠️ Nenhum albumId fornecido!");
    utils.showMessage("image-gallery", "Álbum inválido! Redirecionando...", true);
    setTimeout(() => window.location.href = "index.html", 2000);
    return;
  }

  try {
    console.log(`Verificando existência do álbum: ${albumId}...`);
    utils.toggleLoader("image-gallery", true);
    
    await api.checkAlbum(albumId);
    console.log("Álbum encontrado! Carregando imagens...");
    
    await refreshAlbum(albumId);
  } catch (error) {
    console.error("Erro ao verificar o álbum:", error);
    utils.showMessage("image-gallery", "Erro ao verificar álbum. Redirecionando...", true);
    setTimeout(() => window.location.href = "index.html", 2000);
  }
}

async function refreshAlbum(albumId, forceUpdate = false) {
  if (state.isProcessing && !forceUpdate) {
    console.warn("⚠️ Já está processando! Ignorando nova chamada.");
    return;
  }
  
  if (state.isAlbumDeleted) {
    console.warn("ALERTA: O álbum foi excluído. Não faremos novas tentativas.");
    return;
  }

  state.isProcessing = true;
  const gallery = document.getElementById("image-gallery");

  try {
    console.log("Iniciando refreshAlbum para albumId:", albumId);
    if (!albumId) {
      console.warn("⚠️ Nenhum albumId encontrado na URL!");
      return;
    }

    if (!gallery) {
      console.warn("⚠️ Elemento #image-gallery não encontrado!");
      return;
    }
    
    utils.toggleLoader("image-gallery", true);

    const data = await api.getAlbumImages(albumId, forceUpdate);

    if (Array.isArray(data.images) && data.images.length > 0) {
      console.log("Imagens carregadas com sucesso!");
      displayImages(data.images);
    } else {
      console.warn("⚠️ Nenhuma imagem encontrada.");
      utils.showMessage("image-gallery", "Nenhuma imagem disponível.", true);
    }
  } catch (error) {
    console.error("Erro ao atualizar o álbum:", error);
    
    // Verifica se o erro é 404 (álbum não existe)
    if (error.message.includes("404")) {
      state.isAlbumDeleted = true;
      utils.showMessage("image-gallery", "Este álbum foi excluído ou não existe.", true);
      setTimeout(() => window.location.href = "index.html", 3000);
    } else {
      utils.showMessage("image-gallery", "Erro ao carregar as imagens. Tente novamente mais tarde.", true);
    }
  } finally {
    state.isProcessing = false;
    utils.toggleLoader("image-gallery", false);
  }
}

// Pré-carrega imagens em lotes para melhor performance
function preloadImages(images, batchSize = 5) {
  let index = 0;
  
  function loadNextBatch() {
    const batch = images.slice(index, index + batchSize);
    index += batchSize;
    
    if (batch.length === 0) return;
    
    batch.forEach(image => {
      if (cache.thumbnails.has(image.id)) return;
      
      const img = new Image();
      img.src = `${THUMBNAIL_BASE_URL}${image.id}`;
      img.onload = () => {
        cache.thumbnails.add(image.id);
      };
    });
    
    if (index < images.length) {
      setTimeout(loadNextBatch, 100); // Carrega o próximo lote após 100ms
    }
  }
  
  loadNextBatch();
}

// Exibe imagens com carregamento otimizado
function displayImages(images) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = ""; // Limpa a galeria
  state.imageMap = {};
  state.selectedImages = []; // Reseta as seleções
  
  // Inicia pré-carregamento em segundo plano
  preloadImages(images);

  // Cria um fragmento para melhor performance
  const fragment = document.createDocumentFragment();

  images.forEach(image => {
    state.imageMap[image.id] = image.name;

    // Cria o container
    const container = document.createElement("div");
    container.classList.add("photo-container");

    // Cria a imagem com lazy loading
    const img = document.createElement("img");
    img.loading = "lazy";
    img.classList.add("fade-in");
    img.alt = image.name;
    
    // Usa thumbnail em cache ou carrega novo
    if (cache.thumbnails.has(image.id)) {
      img.src = `${THUMBNAIL_BASE_URL}${image.id}`;
    } else {
      // Placeholder enquanto carrega
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
      
      // Carrega a imagem real
      const actualImage = new Image();
      actualImage.src = `${THUMBNAIL_BASE_URL}${image.id}`;
      actualImage.onload = () => {
        img.src = actualImage.src;
        cache.thumbnails.add(image.id);
        checkAndRemoveLoader();
      };
    }

    // Clique duplo para abrir a imagem
    img.onclick = () => window.open(`${DOWNLOAD_BASE_URL}${image.id}&export=download`, "_blank");

    // Cria a bolinha de seleção
    const circle = document.createElement("div");
    circle.classList.add("selection-circle");
    
    // Ao clicar no container, alterna a seleção
    container.onclick = (e) => {
      if (e.target !== container && !e.target.classList.contains("selection-circle")) return;

      container.classList.toggle("selected");
      const isSelected = container.classList.contains("selected");
      if (isSelected) {
        state.selectedImages.push(image.id);
      } else {
        state.selectedImages = state.selectedImages.filter(id => id !== image.id);
      }
    };

    container.appendChild(img);
    container.appendChild(circle);
    fragment.appendChild(container);
  });
  
  gallery.appendChild(fragment);
  console.log("Imagens carregadas com sucesso!");
}

// Envia selfie e busca rostos similares
async function uploadSelfie() {
  // Pega os inputs
  const fileInput = document.getElementById("fileInput");
  const cameraInput = document.getElementById("cameraInput");

  let file = null;

  // Verifica se o input da câmera tem arquivo
  if (cameraInput && cameraInput.files && cameraInput.files.length > 0) {
    file = cameraInput.files[0];
  }
  // Se não, verifica o input do arquivo
  else if (fileInput && fileInput.files && fileInput.files.length > 0) {
    file = fileInput.files[0];
  }

  if (!file) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const albumId = new URLSearchParams(window.location.search).get("album");
  if (!albumId) {
    console.error("⚠️ Nenhum albumId encontrado!");
    return;
  }

  utils.toggleLoader("image-gallery", true);

  try {
    console.log("Enviando selfie para comparação...");
    
    // Comprime a imagem antes de enviar
    const compressedFile = await compressImage(file);
    const data = await api.uploadSelfie(albumId, compressedFile);
    
    console.log("Resultado da API:", data);

    if (!data.matches || data.matches.length === 0) {
      console.warn("⚠️ Nenhuma imagem similar encontrada.");
      utils.showMessage("image-gallery", "Nenhuma correspondência encontrada.", true);
      return;
    }

    displayMatchingImages(data.matches);
  } catch (error) {
    console.error("Erro ao enviar selfie:", error);
    utils.showMessage("image-gallery", "Erro ao processar sua imagem. Tente novamente mais tarde.", true);
  }
}

// Comprime imagem antes de enviar
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calcula as dimensões mantendo a proporção
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Desenha a imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converte para blob com compressão
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        }, 'image/jpeg', quality);
      };
    };
  });
}

// Exibe os rostos mais similares encontrados
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = ""; // Limpa a galeria
  state.imageMap = {}; // Resetando o mapa de imagens
  state.selectedImages = []; // Resetando as imagens selecionadas

  if (!Array.isArray(matches) || matches.length === 0) {
    console.warn("⚠️ Nenhuma imagem similar encontrada.");
    utils.showMessage("image-gallery", "Nenhuma imagem correspondente.", true);
    return;
  }

  // Cria um fragmento para melhor performance
  const fragment = document.createDocumentFragment();

  matches.forEach(match => {
    const img = document.createElement("img");
    img.src = `${THUMBNAIL_BASE_URL}${match.image_id}`;
    img.alt = ""; // Sem texto de similaridade
    img.loading = "lazy";  // Lazy load
    img.classList.add("fade-in");

    // Evento para quando a imagem for carregada
    img.onload = () => {
      checkAndRemoveLoader(); // Remove o loader quando a imagem carregar
    };

    img.onclick = () => window.open(`${DOWNLOAD_BASE_URL}${match.image_id}&export=download`, "_blank");

    fragment.appendChild(img);
  });

  gallery.appendChild(fragment);
  console.log("Imagens similares carregadas!");
}

function checkAndRemoveLoader() {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;
  
  const loader = gallery.querySelector(".loader");
  if (!loader) return;

  // Verifica se há ao menos uma imagem carregada
  const img = gallery.querySelector("img");
  if (img) {
    loader.style.display = "none"; // Remove o loader
  }
}

// Carrega os álbuns com otimização
const loadAlbums = utils.debounce(async function() {
  if (state.isLoadingAlbums) {
    console.warn("⚠️ Já está carregando os álbuns! Ignorando nova chamada.");
    return;
  }
  state.isLoadingAlbums = true;

  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) {
    console.warn("⚠️ Página sem #album-container, pulando carregamento de álbuns.");
    return;
  }

  utils.toggleLoader("album-container", true);

  try {
    console.log("Buscando álbuns...");
    const data = await api.getAlbums();
    console.log("Álbuns recebidos:", data);

    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      console.warn("⚠️ Nenhum álbum encontrado!");
      utils.showMessage("album-container", "Nenhum álbum disponível.", false);
      return;
    }

    // Limpa o container mantendo o loader
    const loader = albumContainer.querySelector(".loader");
    albumContainer.innerHTML = '';
    if (loader) albumContainer.appendChild(loader);

    // Cria um fragmento para melhor performance
    const fragment = document.createDocumentFragment();
    
    // Para cada álbum, cria um card e puxa apenas a foto "FotoCapa"
    const albumPromises = data.folders.map(async (album) => {
      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");

      const title = document.createElement("h3");
      title.innerText = album.name;

      const coverImg = document.createElement("img");
      coverImg.style.borderRadius = "5px";
      coverImg.style.width = "100%";
      coverImg.style.height = "200px";
      coverImg.style.objectFit = "cover";
      coverImg.style.transition = "transform 0.3s ease";
      coverImg.alt = "Capa do Álbum";

      coverImg.addEventListener("mouseenter", () => {
        coverImg.style.transform = "scale(1.05)";
      });

      coverImg.addEventListener("mouseleave", () => {
        coverImg.style.transform = "scale(1)";
      });

      // Placeholder enquanto carrega
      coverImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

      // Busca as imagens do álbum
      try {
        // Usa cache se disponível
        const cacheKey = `album_images_${album.id}`;
        let imagesData;
        
        if (cache.albums.has(cacheKey)) {
          imagesData = cache.albums.get(cacheKey);
        } else {
          const resImages = await fetch(`${API_URL}/albums/${album.id}/images`);
          if (!resImages.ok) {
            throw new Error("Erro ao carregar imagens do álbum.");
          }
          imagesData = await resImages.json();
          cache.albums.set(cacheKey, imagesData);
        }

        if (Array.isArray(imagesData.images)) {
          const fotoCapa = imagesData.images.find(img =>
            img.name.toLowerCase().startsWith("fotocapa")
          );

          if (fotoCapa) {
            coverImg.src = `${THUMBNAIL_BASE_URL}${fotoCapa.id}`;
          } else {
            coverImg.src = "https://placehold.co/300x200?text=Sem+Capa";
          }
        } else {
          coverImg.src = "https://placehold.co/300x200?text=Sem+Capa";
        }
      } catch (error) {
        coverImg.src = "https://placehold.co/300x200?text=Erro+Capa";
      }

      albumCard.onclick = () => {
        window.location.href = `album.html?album=${album.id}`;
      };

      albumCard.appendChild(coverImg);
      albumCard.appendChild(title);
      
      return albumCard;
    });
    
    // Processa os álbuns em lotes para melhor performance
    const batchSize = 5;
    for (let i = 0; i < albumPromises.length; i += batchSize) {
      const batch = albumPromises.slice(i, i + batchSize);
      const cards = await Promise.all(batch);
      cards.forEach(card => fragment.appendChild(card));
      
      // Atualiza o DOM a cada lote para feedback visual mais rápido
      albumContainer.appendChild(fragment.cloneNode(true));
      fragment.textContent = '';
      
      // Pequena pausa para não bloquear a UI
      if (i + batchSize < albumPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Remove o loader após carregar todos os álbuns
    const finalLoader = albumContainer.querySelector(".loader");
    if (finalLoader) finalLoader.remove();

    console.log("Álbuns exibidos com capa!");
  } catch (error) {
    console.error("Erro ao carregar álbuns:", error);
    utils.showMessage("album-container", "Erro ao carregar os álbuns. Tente novamente mais tarde.", true);
  } finally {
    state.isLoadingAlbums = false; // Resetando o estado após a conclusão
  }
}, 300); // Debounce de 300ms

// Função para baixar imagens selecionadas
async function downloadSelectedImages(selectedIds) {
  if (!selectedIds || selectedIds.length === 0) {
    alert("Nenhuma imagem selecionada!");
    return;
  }
  
  // Verifica se JSZip está disponível
  if (typeof JSZip !== 'function') {
    console.error("JSZip não está disponível!");
    alert("Erro: biblioteca de compressão não encontrada!");
    return;
  }
  
  const zip = new JSZip();
  const imgFolder = zip.folder("imagens");
  
  // Mostra progresso
  const gallery = document.getElementById("image-gallery");
  if (gallery) {
    gallery.innerHTML += `<div id="download-progress" style="position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px;">Preparando download: 0/${selectedIds.length}</div>`;
  }

  // Processa em lotes para não sobrecarregar
  const batchSize = 3;
  let completed = 0;
  
  for (let i = 0; i < selectedIds.length; i += batchSize) {
    const batch = selectedIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (id, batchIndex) => {
      try {
        // Monta a URL original do Drive
        const driveUrl = `${DOWNLOAD_BASE_URL}${id}&export=download`;
        // Monta a URL do proxy (substitua com o domínio real do seu proxy)
        const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl)}`;
        
        const response = await fetch(proxyUrl);
        const blob = await response.blob();
        
        // Usa o nome real da imagem se disponível
        const fileName = state.imageMap[id] ? 
          `${state.imageMap[id]}.jpg` : 
          `imagem_${i + batchIndex + 1}.jpg`;
          
        imgFolder.file(fileName, blob);
        
        // Atualiza progresso
        completed++;
        const progressEl = document.getElementById("download-progress");
        if (progressEl) {
          progressEl.textContent = `Preparando download: ${completed}/${selectedIds.length}`;
        }
      } catch (error) {
        console.error("Erro ao baixar a imagem:", id, error);
      }
    }));
    
    // Pequena pausa entre lotes
    if (i + batchSize < selectedIds.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Gera o arquivo ZIP
  try {
    const content = await zip.generateAsync({ 
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    
    // Cria link de download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "imagens.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Remove indicador de progresso
    const progressEl = document.getElementById("download-progress");
    if (progressEl) progressEl.remove();
  } catch (error) {
    console.error("Erro ao gerar ZIP:", error);
    alert("Erro ao gerar arquivo ZIP. Tente novamente.");
    
    const progressEl = document.getElementById("download-progress");
    if (progressEl) progressEl.remove();
  }
}

// Função para monitorar o container de álbuns (index.html)
function monitorAlbumContainer() {
  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) {
    console.log("album-container não encontrado!");
    return;
  }
  
  console.log("Monitorando album-container para a adição de album-card...");

  // Cria um MutationObserver para observar alterações nos filhos do container
  const observer = new MutationObserver((mutations, obs) => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        console.log("Novos nós adicionados:", mutation.addedNodes);
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("album-card")) {
            console.log("album-card encontrado:", node);
            // Busca a div com a classe "loader" dentro do container
            const loaderDiv = albumContainer.querySelector(".loader");
            if (loaderDiv) {
              loaderDiv.className = ""; // Zera a classe
              console.log("Classe do loader zerada:", loaderDiv);
            } else {
              console.log("Loader não encontrado dentro do album-container.");
            }
            console.log("Desconectando o observador.");
            obs.disconnect();
          }
        });
      }
    });
  });

  observer.observe(albumContainer, { childList: true });
}

// Inicialização
function initApp() {
  document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
      console.log("Carregando lista de álbuns...");
      loadAlbums();
    } else {
      console.log("Página carregada dentro de um álbum, verificando existência...");
      checkAndLoadAlbum(albumId);
    }

    // Configura botões
    const updateAlbumsBtn = document.getElementById("updateAlbumsBtn");
    if (updateAlbumsBtn) {
      updateAlbumsBtn.addEventListener("click", () => loadAlbums());
    }

    const updateAlbumBtn = document.getElementById("updateAlbumBtn");
    if (updateAlbumBtn) {
      updateAlbumBtn.addEventListener("click", () => refreshAlbum(albumId, true));
    }
    
    const selectAllBtn = document.getElementById("select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        const containers = document.querySelectorAll(".photo-container");
        state.selectedImages = [];
        containers.forEach(container => {
          if (!container.classList.contains("selected")) {
            container.classList.add("selected");
            // Obtenha o ID da imagem
            const img = container.querySelector("img");
            const url = img.src;
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch) {
              state.selectedImages.push(idMatch[1]);
            }
          }
        });
        console.log("Selecionadas todas:", state.selectedImages);
      });
    }
    
    const downloadSelectedBtn = document.getElementById("download-selected-btn");
    if (downloadSelectedBtn) {
      downloadSelectedBtn.addEventListener("click", () => {
        if (state.selectedImages.length === 0) {
          alert("Nenhuma imagem selecionada!");
          return;
        }
        downloadSelectedImages(state.selectedImages);
      });
    }
  });
}

// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
window.downloadSelectedImages = downloadSelectedImages;
window.monitorAlbumContainer = monitorAlbumContainer;

// Inicia a aplicação
initApp();
monitorAlbumContainer();

// Análise de performance
console.log("Código otimizado carregado com sucesso!");
