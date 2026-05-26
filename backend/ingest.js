import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function processarPDFs() {
    try {
        console.log("1. A procurar PDFs na pasta ./assests...");
        const pastaAssets = "./assests";

        // Lê todos os arquivos da pasta e filtra apenas os .pdf
        const arquivos = fs.readdirSync(pastaAssets).filter(file => file.endsWith(".pdf"));

        if (arquivos.length === 0) {
            console.log("Nenhum arquivo PDF encontrado na pasta.");
            return;
        }

        let todosDocs = [];

        for (const arquivo of arquivos) {
            console.log(`A carregar: ${arquivo}...`);
            const caminhoCompleto = path.join(pastaAssets, arquivo);
            const loader = new PDFLoader(caminhoCompleto);
            const docs = await loader.load();

            // Você pode manter a lógica de remover o sumário aqui, se todos os PDFs tiverem a mesma estrutura
            const docsSemSumario = docs.filter(doc => doc.metadata.loc.pageNumber >= 5);
            todosDocs.push(...docsSemSumario);
        }

        console.log("2. A dividir o texto em pedaços...");
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await textSplitter.splitDocuments(todosDocs);

        console.log("3. A criar a base de dados vetorial com", chunks.length, "pedaços...");
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
        });

        const vectorStore = await HNSWLib.fromDocuments(chunks, embeddings);
        await vectorStore.save("./banco_vetorial");

        console.log("Sucesso! Todos os PDFs foram processados e aprendidos.");
    } catch (error) {
        console.error("Erro ao processar os PDFs:", error);
    }
}

processarPDFs();