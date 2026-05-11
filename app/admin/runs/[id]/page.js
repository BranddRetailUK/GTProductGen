import RunDetailPanel from "../../../../components/admin/RunDetailPanel.jsx";

export default function Page({ params }) {
  return <RunDetailPanel runId={params.id} />;
}
