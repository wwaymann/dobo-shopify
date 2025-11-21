import MacetaTest from "../../../components/pruebas/MacetaTest";

export default function TestMacetaPage() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px"
      }}
    >
      <h2>Prueba DOBO – Texto Adaptado a Macetas</h2>
      <MacetaTest />
    </div>
  );
}
