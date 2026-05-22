import express from 'express';
import cors from 'cors';
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let ragChain;

async function iniciarIA() {
    console.log("A carregar o conhecimento do PDF...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
        modelName: "text-embedding-004",
    });

    // Mantemos a correção para evitar o Erro 404
    embeddings.embedQuery = async (text) => {
        const res = await embeddings.embedDocuments([text]);
        return res[0];
    };

    const vectorStore = await HNSWLib.load("./banco_vetorial", embeddings);

    // AUMENTAMOS a quantidade de blocos recuperados (k) para 15 para ter mais contexto real
    const retriever = vectorStore.asRetriever({ k: 15 });

    const llm = new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash",
        temperature: 0,
    });

    const systemPrompt = `Você é o assistente virtual oficial do UDF.
Use APENAS o contexto fornecido abaixo para responder à pergunta do aluno. 

REGRA CRUCIAL: IGNORE COMPLETAMENTE O SUMÁRIO/ÍNDICE DO DOCUMENTO. Nunca responda listando nomes de tópicos e números de páginas. Você deve procurar a regra real no meio do texto, ler os detalhes e explicá-los de forma clara e completa para o aluno.

Se a resposta não estiver clara no contexto, diga: 'Desculpe, não encontrei essa informação no manual do aluno.' Não invente informações em circunstância alguma.
    
Contexto extraído do manual:
{context}`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"]
    ]);

    ragChain = RunnableSequence.from([
        {
            context: async (entrada) => {
                const docs = await retriever.invoke(entrada.input);
                const textos = docs.map(doc => doc.pageContent).join("\n\n---\n\n");

                // Registos vitais para diagnóstico no terminal
                console.log(`\n[RAG] ${docs.length} trechos recuperados para a pergunta: "${entrada.input}"`);
                console.log(`[RAG] Prévia do texto lido do PDF:\n`, textos.substring(0, 300) + "...\n");

                return textos;
            },
            input: (entrada) => entrada.input
        },
        prompt,
        llm,
        new StringOutputParser()
    ]);

    console.log("Servidor de IA pronto! A escutar na porta 8000...");
}

app.post('/chat', async (req, res) => {
    const { pergunta } = req.body;

    if (!pergunta) {
        return res.status(400).json({ error: "A pergunta é obrigatória." });
    }

    try {
        const response = await ragChain.invoke({ input: pergunta });
        res.json({ resposta: response });
    } catch (error) {
        console.error("Erro interno no RAG:", error);
        res.status(500).json({ error: "Erro ao processar a pergunta." });
    }
});

iniciarIA().then(() => {
    app.listen(8000, () => {
        console.log('API a correr em http://localhost:8000');
    });
}).catch((error) => {
    console.error('Erro fatal ao inicializar a IA:', error);
});