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

        // Lê todos os ficheiros da pasta e filtra apenas os .pdf
        const arquivos = fs.readdirSync(pastaAssets).filter(file => file.endsWith(".pdf"));

        if (arquivos.length === 0) {
            console.log("Nenhum ficheiro PDF encontrado na pasta.");
            return;
        }

        let todosDocs = [];

        for (const arquivo of arquivos) {
            console.log(`A carregar: ${arquivo}...`);
            const caminhoCompleto = path.join(pastaAssets, arquivo);
            const loader = new PDFLoader(caminhoCompleto);
            const docs = await loader.load();

            // Adiciona o nome do ficheiro aos metadados para a IA saber a origem
            docs.forEach(doc => {
                doc.metadata.ficheiro_origem = arquivo;
            });

            // ATENÇÃO: Removi a restrição de "pageNumber >= 5". 
            // Se tiver PDFs com menos de 5 páginas, eles eram ignorados antes!
            todosDocs.push(...docs);
        }

        console.log("2. A dividir o texto em pedaços organizados...");
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