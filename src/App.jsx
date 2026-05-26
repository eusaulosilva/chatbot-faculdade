import { useState, useRef, useEffect } from 'react';
import './App.css';
import robotImg from './assets/robo.jpg';
import robotGif from './assets/robot.gif';

function App() {
  const [mensagens, setMensagens] = useState([
    { remetente: 'bot', texto: 'Olá! Sou o assistente virtual oficial. Como posso ajudar com as informações dos documentos hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const fimDoChatRef = useRef(null);

  const rolarParaBaixo = () => {
    fimDoChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    rolarParaBaixo();
  }, [mensagens, carregando]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const falarTexto = (texto) => {
    if (!('speechSynthesis' in window)) {
      console.warn("O seu navegador não suporta síntese de voz.");
      return;
    }

    // Limpa qualquer leitura que tenha ficado encravada
    window.speechSynthesis.cancel();
    setPausado(false);

    // Filtro para remover emojis e marcações da voz
    const textoLimpo = texto
      .replace(/[*#]/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '');

    // Divide o texto longo em frases menores (por pontos, exclamações ou linhas)
    // Isso evita que o navegador "corte" o áudio de textos longos
    const pedacos = (textoLimpo.match(/[^.!?\n]+[.!?\n]*/g) || [textoLimpo])
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const vozes = window.speechSynthesis.getVoices();
    let vozEscolhida = null;

    if (vozes.length > 0) {
      const vozPremium = vozes.find(voz =>
        voz.lang.includes('pt-BR') &&
        (voz.name.includes('Google') || voz.name.includes('Microsoft Francisca') || voz.name.includes('Microsoft Antonio') || voz.name.includes('Premium'))
      );
      vozEscolhida = vozPremium || vozes.find(voz => voz.lang.includes('pt-BR'));
    }

    // Pequeno atraso para garantir que o navegador limpou o canal de áudio
    setTimeout(() => {
      if (pedacos.length === 0) return;

      // Envia cada frase para a fila de reprodução do navegador
      pedacos.forEach((frase, index) => {
        const utterance = new SpeechSynthesisUtterance(frase);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        if (vozEscolhida) utterance.voice = vozEscolhida;

        // Quando a PRIMEIRA frase da fila começa a ser lida
        if (index === 0) {
          utterance.onstart = () => {
            setFalando(true);
            setPausado(false);
          };
        }

        // Quando a ÚLTIMA frase da fila termina de ser lida
        if (index === pedacos.length - 1) {
          utterance.onend = () => {
            setFalando(false);
            setPausado(false);
          };
        }

        utterance.onerror = (e) => {
          console.error("Erro na leitura da frase:", e);
        };

        // Adiciona à fila de leitura invisível
        window.speechSynthesis.speak(utterance);
      });
    }, 100);
  };

  // Função para Pausar e Retomar
  const pausarAudio = () => {
    if ('speechSynthesis' in window) {
      if (pausado) {
        window.speechSynthesis.resume();
        setPausado(false);
      } else {
        window.speechSynthesis.pause();
        setPausado(true);
      }
    }
  };

  const pararAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setFalando(false);
      setPausado(false);
    }
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    window.speechSynthesis.cancel();
    setFalando(false);
    setPausado(false);

    const novaMensagemUsuario = { remetente: 'user', texto: input };
    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setInput('');
    setCarregando(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: novaMensagemUsuario.texto }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do servidor");
      }

      const data = await response.json();

      // Limpa os asteriscos do texto ANTES de mostrar no ecrã visual
      const respostaVisual = data.resposta.replace(/\*/g, '');

      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: respostaVisual }
      ]);

      // Manda a resposta para ser falada (em pedaços)
      falarTexto(respostaVisual);

    } catch (error) {
      console.error("Erro de ligação:", error);
      const erroMsg = 'Desculpe, ocorreu um erro de ligação. Verifique se o servidor backend está a correr.';
      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: erroMsg }
      ]);
      falarTexto(erroMsg);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-background">
      <div className="chat-container">
        <header className="chat-header">
          <div className="header-text">
            <h2>Assistente Virtual</h2>
            <p>Dúvidas sobre os documentos da Faculdade</p>
          </div>
        </header>

        <div className="avatar-section">
          {/* Se estiver pausado, o avatar volta a ser a imagem estática em vez do GIF */}
          <div className={`avatar-wrapper ${falando && !pausado ? 'is-talking' : ''}`}>
            <img
              src={falando && !pausado ? robotGif : robotImg}
              alt="Avatar"
              className="avatar-image"
            />
          </div>

          {falando && (
            <div className="audio-controls">
              <span className="status-falando">
                <span className={`dot-pulse ${pausado ? 'paused' : ''}`}></span>
                {pausado ? 'Leitura Pausada' : 'A falar...'}
              </span>

              <div className="audio-buttons">
                <button onClick={pausarAudio} className="pause-audio-btn" title={pausado ? "Retomar" : "Pausar"}>
                  {pausado ? '▶ Retomar' : '⏸ Pausar'}
                </button>
                <button onClick={pararAudio} className="stop-audio-btn" title="Parar Áudio">
                  ⏹ Parar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="chat-messages">
          {mensagens.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.remetente}`}>
              <div className={`message ${msg.remetente}`}>
                {msg.texto}
              </div>
            </div>
          ))}

          {carregando && (
            <div className="message-wrapper bot">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={fimDoChatRef} />
        </div>

        <form className="chat-input-container" onSubmit={enviarMensagem}>
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva a sua dúvida aqui..."
            disabled={carregando}
          />
          <button type="submit" className="send-button" disabled={carregando || !input.trim()}>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;