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
  }, []);

  const falarTexto = (texto) => {
    if (!('speechSynthesis' in window)) {
      console.warn("O seu navegador não suporta síntese de voz.");
      return;
    }

    window.speechSynthesis.cancel();

    const textoLimpo = texto.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(textoLimpo);

    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const vozes = window.speechSynthesis.getVoices();
    const vozPremium = vozes.find(voz =>
      voz.lang.includes('pt-BR') &&
      (voz.name.includes('Google') || voz.name.includes('Microsoft Francisca') || voz.name.includes('Microsoft Antonio') || voz.name.includes('Premium'))
    );

    if (vozPremium) {
      utterance.voice = vozPremium;
    } else {
      const vozPadrao = vozes.find(voz => voz.lang.includes('pt-BR'));
      if (vozPadrao) utterance.voice = vozPadrao;
    }

    utterance.onstart = () => setFalando(true);
    utterance.onend = () => setFalando(false);
    utterance.onerror = () => setFalando(false);

    window.speechSynthesis.speak(utterance);
  };

  // NOVA FUNÇÃO: Para interromper o áudio manualmente
  const pararAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setFalando(false);
    }
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    window.speechSynthesis.cancel();
    setFalando(false);

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

      const data = await response.json();

      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: data.resposta }
      ]);

      falarTexto(data.resposta);

    } catch (error) {
      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: 'Desculpe, ocorreu um erro ao ligar ao servidor. Tente novamente.' }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-background">
      <div className="chat-container">
        <header className="chat-header">
          <h2>Assistente Virtual da Faculdade</h2>
          <p>Tire as suas dúvidas sobre os documentos</p>
        </header>

        <div className="avatar-section">
          <div className={`avatar-wrapper ${falando ? 'is-talking' : ''}`}>
            <img
              src={falando ? robotGif : robotImg}
              alt="Avatar do Assistente"
              className="avatar-image"
            />
          </div>

          {/* NOVA ÁREA: Status e botão de parar lado a lado */}
          {falando && (
            <div className="audio-controls">
              <p className="status-falando">🗣️ O assistente está a falar...</p>
              <button onClick={pararAudio} className="stop-audio-btn" title="Parar Áudio">
                ⏹️ Parar
              </button>
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
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;