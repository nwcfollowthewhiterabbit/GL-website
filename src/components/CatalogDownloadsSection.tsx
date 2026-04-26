import { BookOpen, Download, ExternalLink } from "lucide-react";
import type { WebsiteCatalogDownload } from "../types";

type CatalogDownloadsSectionProps = {
  catalogs: WebsiteCatalogDownload[];
};

export function CatalogDownloadsSection({ catalogs }: CatalogDownloadsSectionProps) {
  if (!catalogs.length) return null;

  return (
    <section className="shell section catalog-downloads" id="catalogs">
      <div className="section-heading">
        <span>
          <BookOpen size={18} /> Catalogues
        </span>
        <h2>Download supplier catalogues.</h2>
        <p>Current PDF catalogues can be managed from ERPNext and shown here without changing the storefront code.</p>
      </div>

      <div className="catalog-downloads__grid">
        {catalogs.map((catalog) => (
          <article className="catalog-download-card" key={catalog.id}>
            <div className="catalog-download-card__icon">
              <BookOpen size={24} />
            </div>
            <div>
              <span>{catalog.sourceLabel || "Catalogue"}</span>
              <h3>{catalog.title}</h3>
              <p>{catalog.description}</p>
            </div>
            <a href={catalog.fileUrl} target="_blank" rel="noreferrer">
              <Download size={18} /> Download <ExternalLink size={16} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
