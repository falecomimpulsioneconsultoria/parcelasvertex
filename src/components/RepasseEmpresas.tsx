import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  Divider,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BusinessIcon from '@mui/icons-material/Business';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import UndoIcon from '@mui/icons-material/Undo';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Empresa, LancamentoVenda, StatusParcela } from '../types';
import { obterStatusEfetivo } from '../utils/formatters';

// ──────────────────────────────────────────────────────────
// Helpers de formatação
// ──────────────────────────────────────────────────────────

const NOMES_MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatarData = (iso?: string): string => {
  if (!iso || iso.includes('undefined')) return '—';
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const formatarMesAno = (ym: string): string => {
  if (!ym || !ym.includes('-')) return ym || '—';
  const [ano, mes] = ym.split('-');
  return `${NOMES_MESES[mes] || mes}/${ano}`;
};

const hojeISO = (): string => {
  const d = new Date();
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
};

// ──────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────

export type StatusRepasseParcela =
  | 'Repassada'
  | 'Pronto p/ Repasse'
  | 'Aguardando ADM'
  | 'Aguardando Cliente';

type CriterioDataFiltro = 'vencimento' | 'recebimento_adm' | 'repasse';

interface ParcelaRepasseItem {
  id: string; // `${vendaId}__${mesChave}`
  vendaId: string;
  mesChave: string;
  empresaId: string;
  empresaNome: string;
  cliente: string;
  pac: string;
  administradoraNome: string;
  vendedorNome: string;
  tabela: string;
  segmento: string;
  parcelaIndex: number;
  qtdParcelas: number;
  valorVenda: number;
  valorParcela: number;
  dataVenda: string;
  dataVencimento: string;
  dataRecebimentoAdm?: string;
  numeroRelatorioAdm?: string;
  statusParcela: StatusParcela;
  recebidaAdm: boolean;
  // Valores financeiros
  comissaoBase: number;        // Tabela base (InvestCon Master) = comissaoFilha + diferencaMaster
  diferencaMaster: number;     // Spread que fica para a InvestCon Master (da venda espelho)
  comissaoFilha: number;       // Valor líquido a repassar para a empresa filha
  // Controle de repasse
  statusRepasse: StatusRepasseParcela;
  repassePago: boolean;
  dataRepasse?: string;
  comprovanteRepasse?: string;
  observacaoRepasse?: string;
}

interface ResumoEmpresaFilha {
  empresaId: string;
  empresaNome: string;
  qtdTotal: number;
  qtdProntas: number;
  qtdRepassadas: number;
  valorProntoRepasse: number;
  valorRepassado: number;
  valorAguardando: number;
  valorDiferencaMaster: number;
  valorBaseTotal: number;
}

interface GrupoMesRepasse {
  mesChave: string;
  itens: ParcelaRepasseItem[];
  totalBase: number;
  totalDiferencaMaster: number;
  totalFilha: number;
  totalProntoRepasse: number;
  totalRepassado: number;
  qtdProntas: number;
  qtdRepassadas: number;
}

export interface RepasseEmpresasProps {
  vendas: LancamentoVenda[];
  empresas: Empresa[];
  dataInicio: string;
  dataFim: string;
  podeGerenciar: boolean;       // True para super_master, financeiro_master e master/financeiro da matriz
  isSuperOuFinanceiroMaster: boolean;
  empresaAtualId?: string;
  empresaFiltroHeader?: string; // Filtro global de empresa no header (quando super_master/financeiro_master)
  onAtualizarVenda: (venda: LancamentoVenda) => void;
}

// ──────────────────────────────────────────────────────────
// Badges de Status
// ──────────────────────────────────────────────────────────

const StatusRepasseBadge: React.FC<{ status: StatusRepasseParcela; dataRepasse?: string }> = ({
  status,
  dataRepasse,
}) => {
  const map: Record<StatusRepasseParcela, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    'Repassada': {
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: <CheckCircleIcon sx={{ fontSize: 13 }} />,
    },
    'Pronto p/ Repasse': {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      icon: <PaymentsIcon sx={{ fontSize: 13 }} />,
    },
    'Aguardando ADM': {
      color: '#0ea5e9',
      bg: 'rgba(14, 165, 233, 0.13)',
      border: 'rgba(14, 165, 233, 0.3)',
      icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} />,
    },
    'Aguardando Cliente': {
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.25)',
      icon: <ScheduleIcon sx={{ fontSize: 13 }} />,
    },
  };
  const cfg = map[status];

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.2 }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.1,
          py: 0.28,
          borderRadius: 99,
          bgcolor: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          fontWeight: 700,
          fontSize: '0.7rem',
          whiteSpace: 'nowrap',
        }}
      >
        {cfg.icon}
        {status}
      </Box>
      {status === 'Repassada' && dataRepasse && (
        <Typography variant="caption" sx={{ fontSize: '0.63rem', color: '#10b981', fontWeight: 600, pl: 0.5 }}>
          em {formatarData(dataRepasse)}
        </Typography>
      )}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────
// Exportação PDF (Extrato Filha ou Gerencial Master)
// ──────────────────────────────────────────────────────────

const exportarRepassePDF = (
  itens: ParcelaRepasseItem[],
  modo: 'extrato_filha' | 'gerencial_master',
  periodoTexto: string,
  empresaTitulo: string
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const totalBase = itens.reduce((s, i) => s + i.comissaoBase, 0);
  const totalDif = itens.reduce((s, i) => s + i.diferencaMaster, 0);
  const totalFilha = itens.reduce((s, i) => s + i.comissaoFilha, 0);
  const totalRepassado = itens.filter(i => i.repassePago).reduce((s, i) => s + i.comissaoFilha, 0);
  const totalPendente = itens.filter(i => !i.repassePago).reduce((s, i) => s + i.comissaoFilha, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229);
  doc.text(
    modo === 'gerencial_master'
      ? `APEX - Relatório Gerencial de Repasses (${empresaTitulo})`
      : `APEX - Extrato de Repasse de Comissões (${empresaTitulo})`,
    14,
    15
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${periodoTexto}  |  Gerado em: ${formatarData(hojeISO())}  |  Parcelas: ${itens.length}`, 14, 21);

  doc.setFillColor(248, 250, 252);
  doc.rect(14, 25, 269, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  if (modo === 'gerencial_master') {
    doc.text(`Base Total (ADM): ${formatarMoeda(totalBase)}`, 18, 33.5);
    doc.text(`Diferença Master: ${formatarMoeda(totalDif)}`, 86, 33.5);
    doc.text(`Repasse Empresas: ${formatarMoeda(totalFilha)}`, 152, 33.5);
    doc.text(`Já Pago: ${formatarMoeda(totalRepassado)}`, 222, 33.5);
  } else {
    doc.text(`Total Comissões: ${formatarMoeda(totalFilha)}`, 18, 33.5);
    doc.text(`Já Repassado: ${formatarMoeda(totalRepassado)}`, 110, 33.5);
    doc.text(`A Repassar: ${formatarMoeda(totalPendente)}`, 200, 33.5);
  }

  const headers = modo === 'gerencial_master'
    ? [
        'Empresa',
        'Cliente / PAC',
        'Tabela',
        'Parc.',
        'Vencimento',
        'Rec. ADM',
        'Base (ADM)',
        'Dif. Master',
        'Valor Repasse',
        'Status Repasse',
        'Dt. Repasse / Ref.',
      ]
    : [
        'Empresa',
        'Cliente / PAC',
        'Tabela',
        'Parc.',
        'Vencimento',
        'Valor Cota',
        'Comissão Repasse',
        'Status Repasse',
        'Dt. Repasse',
        'Comprovante / Ref.',
      ];

  const rows = itens.map(i =>
    modo === 'gerencial_master'
      ? [
          i.empresaNome,
          i.cliente + (i.pac ? `\nPAC: ${i.pac}` : ''),
          i.tabela,
          `${i.parcelaIndex}/${i.qtdParcelas}`,
          formatarData(i.dataVencimento),
          i.recebidaAdm ? (i.dataRecebimentoAdm ? formatarData(i.dataRecebimentoAdm) : 'Sim') : 'Não',
          formatarMoeda(i.comissaoBase),
          formatarMoeda(i.diferencaMaster),
          formatarMoeda(i.comissaoFilha),
          i.statusRepasse,
          [i.dataRepasse ? formatarData(i.dataRepasse) : '', i.comprovanteRepasse || ''].filter(Boolean).join(' · ') || '—',
        ]
      : [
          i.empresaNome,
          i.cliente + (i.pac ? `\nPAC: ${i.pac}` : ''),
          i.tabela,
          `${i.parcelaIndex}/${i.qtdParcelas}`,
          formatarData(i.dataVencimento),
          formatarMoeda(i.valorVenda),
          formatarMoeda(i.comissaoFilha),
          i.statusRepasse,
          i.dataRepasse ? formatarData(i.dataRepasse) : '—',
          i.comprovanteRepasse || '—',
        ]
  );

  autoTable(doc, {
    startY: 43,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 7.8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.4,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    margin: { left: 14, right: 14 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const txt = `Página ${p} de ${totalPages}`;
    doc.text(txt, 283 - doc.getTextWidth(txt), 200);
    doc.text('APEX - Controle de Repasse às Empresas', 14, 200);
  }

  const sufixo = modo === 'gerencial_master' ? 'gerencial' : 'extrato';
  const nomeEmpSlug = empresaTitulo.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`apex_repasse_${sufixo}_${nomeEmpSlug}_${hojeISO()}.pdf`);
};

// ──────────────────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────────────────

export const RepasseEmpresas: React.FC<RepasseEmpresasProps> = ({
  vendas,
  empresas,
  dataInicio,
  dataFim,
  podeGerenciar,
  isSuperOuFinanceiroMaster,
  empresaAtualId,
  empresaFiltroHeader,
  onAtualizarVenda,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Filtros internos
  const [empresaFiltroLocal, setEmpresaFiltroLocal] = useState<string>('');
  const [statusFiltro, setStatusFiltro] = useState<'TODOS' | StatusRepasseParcela>('TODOS');
  const [criterioData, setCriterioData] = useState<CriterioDataFiltro>('vencimento');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // Seleção para baixa em lote
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  // Grupos mensais expandidos (por padrão expande todos os meses visíveis)
  const [mesesRecolhidos, setMesesRecolhidos] = useState<Record<string, boolean>>({});

  // Modal de confirmação de repasse (individual ou em lote)
  const [modalRepasseAberto, setModalRepasseAberto] = useState(false);
  const [itensParaRepassar, setItensParaRepassar] = useState<ParcelaRepasseItem[]>([]);
  const [dataRepasseInput, setDataRepasseInput] = useState<string>(hojeISO());
  const [comprovanteInput, setComprovanteInput] = useState<string>('');
  const [observacaoInput, setObservacaoInput] = useState<string>('');

  // Modal de desfazer repasse
  const [itensParaDesfazer, setItensParaDesfazer] = useState<ParcelaRepasseItem[]>([]);

  // Menu de exportação PDF (Master escolhe Extrato Filha ou Gerencial)
  const [menuPdfAnchor, setMenuPdfAnchor] = useState<null | HTMLElement>(null);

  // Feedback Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'info' | 'warning' }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  // 1. Empresas filhas visíveis conforme perfil
  const empresasFilhasVisiveis = useMemo(() => {
    const todasFilhas = empresas.filter(e => !!e.empresaMaeId);
    if (!podeGerenciar) {
      // Usuário de empresa filha: vê apenas a própria empresa
      return empresas.filter(e => e.id === empresaAtualId);
    }
    if (isSuperOuFinanceiroMaster) {
      return todasFilhas;
    }
    // Master/Financeiro de uma empresa mãe específica: vê apenas as filhas dela
    return todasFilhas.filter(e => e.empresaMaeId === empresaAtualId);
  }, [empresas, podeGerenciar, isSuperOuFinanceiroMaster, empresaAtualId]);

  const idsFilhasVisiveis = useMemo(
    () => new Set(empresasFilhasVisiveis.map(e => e.id)),
    [empresasFilhasVisiveis]
  );

  const mapaEmpresas = useMemo(() => {
    const m = new Map<string, Empresa>();
    empresas.forEach(e => m.set(e.id, e));
    return m;
  }, [empresas]);

  // Filtro efetivo de empresa (se o header já filtrou uma filha, respeita; senão usa o filtro local)
  const empresaEfetivaFiltro = useMemo(() => {
    if (!podeGerenciar) return empresaAtualId || '';
    if (empresaFiltroHeader && idsFilhasVisiveis.has(empresaFiltroHeader)) {
      return empresaFiltroHeader;
    }
    return empresaFiltroLocal;
  }, [podeGerenciar, empresaAtualId, empresaFiltroHeader, idsFilhasVisiveis, empresaFiltroLocal]);

  // 2. Mapa de vendas espelho (vendaOrigemId -> LancamentoVenda espelho da mãe)
  const mapaEspelhos = useMemo(() => {
    const map = new Map<string, LancamentoVenda>();
    vendas.forEach(v => {
      if (v.isVendaEspelho && v.vendaOrigemId) {
        map.set(v.vendaOrigemId, v);
      }
    });
    return map;
  }, [vendas]);

  // 3. Construção da lista plana de parcelas de repasse
  const todasParcelasBase = useMemo<ParcelaRepasseItem[]>(() => {
    const lista: ParcelaRepasseItem[] = [];

    vendas.forEach(venda => {
      if (venda.isVendaEspelho) return;
      const empId = venda.empresaId || 'emp_vertex';
      if (!idsFilhasVisiveis.has(empId)) return;

      const empNome = mapaEmpresas.get(empId)?.nome || empId;
      const espelho = mapaEspelhos.get(venda.id);
      const chavesOrdenadas = Object.keys(venda.projecaoMensal || {}).sort();

      chavesOrdenadas.forEach((mesChave, idx) => {
        const parcela = venda.projecaoMensal[mesChave];
        if (!parcela) return;

        const statusEfetivo = obterStatusEfetivo(parcela.status, parcela.dataVencimento);
        const repassePago = Boolean(parcela.repasseEmpresaPago);

        // Ignora parcelas canceladas/estornadas que não tiveram repasse pago
        if ((statusEfetivo === 'Cancelada' || statusEfetivo === 'Estornada') && !repassePago) {
          return;
        }

        const comissaoFilha = Number(parcela.comissaoGerada || 0);
        const comissaoEspelho = Number(espelho?.projecaoMensal?.[mesChave]?.comissaoGerada || 0);
        const comissaoBase = Number((comissaoFilha + comissaoEspelho).toFixed(2));

        // Ignora parcelas zeradas sem comissão
        if (comissaoFilha <= 0 && comissaoEspelho <= 0) return;

        const recebidaAdm = Boolean(parcela.recebida);

        let statusRepasse: StatusRepasseParcela;
        if (repassePago) {
          statusRepasse = 'Repassada';
        } else if (recebidaAdm) {
          statusRepasse = 'Pronto p/ Repasse';
        } else if (statusEfetivo === 'Paga') {
          statusRepasse = 'Aguardando ADM';
        } else {
          statusRepasse = 'Aguardando Cliente';
        }

        // Filtro por período conforme critério escolhido
        const dataRef =
          criterioData === 'recebimento_adm'
            ? (parcela.dataRelatorioRecebimento || parcela.dataRecebimento || '')
            : criterioData === 'repasse'
              ? (parcela.dataRepasseEmpresa || '')
              : (parcela.dataVencimento || '');

        if (dataInicio && dataFim) {
          if (!dataRef) return;
          if (dataRef < dataInicio || dataRef > dataFim) return;
        }

        lista.push({
          id: `${venda.id}__${mesChave}`,
          vendaId: venda.id,
          mesChave,
          empresaId: empId,
          empresaNome: empNome,
          cliente: venda.cliente || 'Cliente não informado',
          pac: venda.pac || '',
          administradoraNome: venda.administradoraNome || '—',
          vendedorNome: venda.vendedorNome || '—',
          tabela: venda.tabela || '—',
          segmento: venda.segmento || '—',
          parcelaIndex: idx + 1,
          qtdParcelas: venda.qtdParcelas || chavesOrdenadas.length,
          valorVenda: Number(parcela.valorVenda || venda.valorVenda || 0),
          valorParcela: Number(parcela.valorParcela || venda.valorParcela || 0),
          dataVenda: venda.dataVenda || '',
          dataVencimento: parcela.dataVencimento || '',
          dataRecebimentoAdm: parcela.dataRelatorioRecebimento || parcela.dataRecebimento,
          numeroRelatorioAdm: parcela.numeroRelatorioRecebimento || venda.numeroRelatorio,
          statusParcela: statusEfetivo,
          recebidaAdm,
          comissaoBase,
          diferencaMaster: comissaoEspelho,
          comissaoFilha,
          statusRepasse,
          repassePago,
          dataRepasse: parcela.dataRepasseEmpresa,
          comprovanteRepasse: parcela.comprovanteRepasseEmpresa,
          observacaoRepasse: parcela.observacaoRepasseEmpresa,
        });
      });
    });

    return lista;
  }, [vendas, idsFilhasVisiveis, mapaEmpresas, mapaEspelhos, dataInicio, dataFim, criterioData]);

  // 4. Resumo por empresa filha (antes do filtro local de empresa, para os cards de seleção rápida)
  const resumoPorEmpresa = useMemo<ResumoEmpresaFilha[]>(() => {
    const mapa = new Map<string, ResumoEmpresaFilha>();

    empresasFilhasVisiveis.forEach(emp => {
      mapa.set(emp.id, {
        empresaId: emp.id,
        empresaNome: emp.nome,
        qtdTotal: 0,
        qtdProntas: 0,
        qtdRepassadas: 0,
        valorProntoRepasse: 0,
        valorRepassado: 0,
        valorAguardando: 0,
        valorDiferencaMaster: 0,
        valorBaseTotal: 0,
      });
    });

    todasParcelasBase.forEach(item => {
      const r = mapa.get(item.empresaId);
      if (!r) return;
      r.qtdTotal += 1;
      r.valorDiferencaMaster += item.diferencaMaster;
      r.valorBaseTotal += item.comissaoBase;
      if (item.statusRepasse === 'Repassada') {
        r.qtdRepassadas += 1;
        r.valorRepassado += item.comissaoFilha;
      } else if (item.statusRepasse === 'Pronto p/ Repasse') {
        r.qtdProntas += 1;
        r.valorProntoRepasse += item.comissaoFilha;
      } else {
        r.valorAguardando += item.comissaoFilha;
      }
    });

    return Array.from(mapa.values()).sort((a, b) => b.valorProntoRepasse - a.valorProntoRepasse || a.empresaNome.localeCompare(b.empresaNome));
  }, [empresasFilhasVisiveis, todasParcelasBase]);

  // 5. Aplicar filtros de empresa, status e busca textual
  const parcelasFiltradas = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase();
    return todasParcelasBase.filter(item => {
      if (empresaEfetivaFiltro && item.empresaId !== empresaEfetivaFiltro) return false;
      if (statusFiltro !== 'TODOS' && item.statusRepasse !== statusFiltro) return false;
      if (termo) {
        const bate =
          item.cliente.toLowerCase().includes(termo) ||
          item.pac.toLowerCase().includes(termo) ||
          item.empresaNome.toLowerCase().includes(termo) ||
          item.vendedorNome.toLowerCase().includes(termo) ||
          item.tabela.toLowerCase().includes(termo) ||
          (item.comprovanteRepasse || '').toLowerCase().includes(termo) ||
          (item.numeroRelatorioAdm || '').toLowerCase().includes(termo);
        if (!bate) return false;
      }
      return true;
    });
  }, [todasParcelasBase, empresaEfetivaFiltro, statusFiltro, buscaTexto]);

  // 6. KPIs consolidados
  const kpis = useMemo(() => {
    let prontoRepasse = 0;
    let qtdProntas = 0;
    let repassado = 0;
    let qtdRepassadas = 0;
    let aguardando = 0;
    let qtdAguardando = 0;
    let diferencaMasterTotal = 0;
    let diferencaMasterRecebida = 0;
    let baseTotal = 0;

    parcelasFiltradas.forEach(item => {
      baseTotal += item.comissaoBase;
      diferencaMasterTotal += item.diferencaMaster;
      if (item.recebidaAdm || item.repassePago) {
        diferencaMasterRecebida += item.diferencaMaster;
      }
      if (item.statusRepasse === 'Repassada') {
        repassado += item.comissaoFilha;
        qtdRepassadas += 1;
      } else if (item.statusRepasse === 'Pronto p/ Repasse') {
        prontoRepasse += item.comissaoFilha;
        qtdProntas += 1;
      } else {
        aguardando += item.comissaoFilha;
        qtdAguardando += 1;
      }
    });

    const percentualRetencao = baseTotal > 0 ? (diferencaMasterTotal / baseTotal) * 100 : 0;

    return {
      prontoRepasse,
      qtdProntas,
      repassado,
      qtdRepassadas,
      aguardando,
      qtdAguardando,
      diferencaMasterTotal,
      diferencaMasterRecebida,
      baseTotal,
      percentualRetencao,
    };
  }, [parcelasFiltradas]);

  // 7. Agrupamento por mês
  const gruposPorMes = useMemo<GrupoMesRepasse[]>(() => {
    const mapa = new Map<string, GrupoMesRepasse>();

    parcelasFiltradas.forEach(item => {
      const chaveMes =
        criterioData === 'recebimento_adm' && item.dataRecebimentoAdm
          ? item.dataRecebimentoAdm.substring(0, 7)
          : criterioData === 'repasse' && item.dataRepasse
            ? item.dataRepasse.substring(0, 7)
            : (item.dataVencimento ? item.dataVencimento.substring(0, 7) : item.mesChave);

      if (!mapa.has(chaveMes)) {
        mapa.set(chaveMes, {
          mesChave: chaveMes,
          itens: [],
          totalBase: 0,
          totalDiferencaMaster: 0,
          totalFilha: 0,
          totalProntoRepasse: 0,
          totalRepassado: 0,
          qtdProntas: 0,
          qtdRepassadas: 0,
        });
      }
      const g = mapa.get(chaveMes)!;
      g.itens.push(item);
      g.totalBase += item.comissaoBase;
      g.totalDiferencaMaster += item.diferencaMaster;
      g.totalFilha += item.comissaoFilha;
      if (item.statusRepasse === 'Pronto p/ Repasse') {
        g.totalProntoRepasse += item.comissaoFilha;
        g.qtdProntas += 1;
      } else if (item.statusRepasse === 'Repassada') {
        g.totalRepassado += item.comissaoFilha;
        g.qtdRepassadas += 1;
      }
    });

    // Ordena itens dentro de cada mês por empresa -> data de vencimento -> cliente
    const grupos = Array.from(mapa.values()).sort((a, b) => a.mesChave.localeCompare(b.mesChave));
    grupos.forEach(g => {
      g.itens.sort((a, b) =>
        a.empresaNome.localeCompare(b.empresaNome) ||
        a.dataVencimento.localeCompare(b.dataVencimento) ||
        a.cliente.localeCompare(b.cliente)
      );
    });
    return grupos;
  }, [parcelasFiltradas, criterioData]);

  // 8. Itens atualmente selecionados (interseção com parcelasFiltradas)
  const itensSelecionadosObj = useMemo(() => {
    const setIds = new Set(selecionadas);
    return parcelasFiltradas.filter(i => setIds.has(i.id));
  }, [parcelasFiltradas, selecionadas]);

  const toggleSelecionarItem = (id: string) => {
    setSelecionadas(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelecionarGrupo = (idsGrupo: string[], marcar: boolean) => {
    if (marcar) {
      setSelecionadas(prev => Array.from(new Set([...prev, ...idsGrupo])));
    } else {
      const setRem = new Set(idsGrupo);
      setSelecionadas(prev => prev.filter(x => !setRem.has(x)));
    }
  };

  const handleSelecionarProntas = () => {
    const idsProntas = parcelasFiltradas
      .filter(i => i.statusRepasse === 'Pronto p/ Repasse')
      .map(i => i.id);
    setSelecionadas(idsProntas);
    if (idsProntas.length === 0) {
      setSnackbar({
        open: true,
        msg: 'Não há parcelas com status "Pronto p/ Repasse" no filtro atual.',
        severity: 'info',
      });
    }
  };

  // 9. Abrir modal de registro de repasse (individual ou lote)
  const abrirModalRepasse = (itens: ParcelaRepasseItem[]) => {
    const naoPagas = itens.filter(i => !i.repassePago);
    if (naoPagas.length === 0) {
      setSnackbar({
        open: true,
        msg: 'Todas as parcelas selecionadas já estão marcadas como repassadas.',
        severity: 'info',
      });
      return;
    }
    setItensParaRepassar(naoPagas);
    setDataRepasseInput(hojeISO());
    setComprovanteInput('');
    setObservacaoInput('');
    setModalRepasseAberto(true);
  };

  // 10. Confirmar repasse e persistir nas vendas
  const handleConfirmarRepasse = () => {
    if (itensParaRepassar.length === 0) return;

    // Agrupa por vendaId para salvar cada venda apenas uma vez
    const porVenda = new Map<string, ParcelaRepasseItem[]>();
    itensParaRepassar.forEach(item => {
      const arr = porVenda.get(item.vendaId) || [];
      arr.push(item);
      porVenda.set(item.vendaId, arr);
    });

    porVenda.forEach((parcelasDaVenda, vendaId) => {
      const vendaOriginal = vendas.find(v => v.id === vendaId);
      if (!vendaOriginal) return;

      const novaProjecao = { ...vendaOriginal.projecaoMensal };
      parcelasDaVenda.forEach(p => {
        const celula = novaProjecao[p.mesChave];
        if (!celula) return;
        novaProjecao[p.mesChave] = {
          ...celula,
          repasseEmpresaPago: true,
          dataRepasseEmpresa: dataRepasseInput || hojeISO(),
          comprovanteRepasseEmpresa: comprovanteInput.trim() || undefined,
          observacaoRepasseEmpresa: observacaoInput.trim() || undefined,
        };
      });

      onAtualizarVenda({
        ...vendaOriginal,
        projecaoMensal: novaProjecao,
      });
    });

    const qtd = itensParaRepassar.length;
    const totalValor = itensParaRepassar.reduce((s, i) => s + i.comissaoFilha, 0);

    setModalRepasseAberto(false);
    setItensParaRepassar([]);
    setSelecionadas([]);
    setSnackbar({
      open: true,
      msg: `Repasse registrado com sucesso: ${qtd} parcela(s) totalizando ${formatarMoeda(totalValor)}.`,
      severity: 'success',
    });
  };

  // 11. Desfazer repasse (individual ou em lote)
  const handleConfirmarDesfazer = () => {
    if (itensParaDesfazer.length === 0) return;

    const porVenda = new Map<string, ParcelaRepasseItem[]>();
    itensParaDesfazer.forEach(item => {
      const arr = porVenda.get(item.vendaId) || [];
      arr.push(item);
      porVenda.set(item.vendaId, arr);
    });

    porVenda.forEach((parcelasDaVenda, vendaId) => {
      const vendaOriginal = vendas.find(v => v.id === vendaId);
      if (!vendaOriginal) return;

      const novaProjecao = { ...vendaOriginal.projecaoMensal };
      parcelasDaVenda.forEach(p => {
        const celula = novaProjecao[p.mesChave];
        if (!celula) return;
        novaProjecao[p.mesChave] = {
          ...celula,
          repasseEmpresaPago: false,
          dataRepasseEmpresa: undefined,
          comprovanteRepasseEmpresa: undefined,
          observacaoRepasseEmpresa: undefined,
        };
      });

      onAtualizarVenda({
        ...vendaOriginal,
        projecaoMensal: novaProjecao,
      });
    });

    const qtd = itensParaDesfazer.length;
    setItensParaDesfazer([]);
    setSelecionadas([]);
    setSnackbar({
      open: true,
      msg: `Repasse estornado em ${qtd} parcela(s).`,
      severity: 'warning',
    });
  };

  // 12. Exportação PDF
  const executarExportacaoPDF = (modo: 'extrato_filha' | 'gerencial_master') => {
    setMenuPdfAnchor(null);
    const itensExport = itensSelecionadosObj.length > 0 ? itensSelecionadosObj : parcelasFiltradas;
    if (itensExport.length === 0) {
      setSnackbar({ open: true, msg: 'Nenhuma parcela disponível para exportar.', severity: 'info' });
      return;
    }
    const periodoTexto = `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
    const empresaTitulo = empresaEfetivaFiltro
      ? (mapaEmpresas.get(empresaEfetivaFiltro)?.nome || 'Empresa')
      : 'Todas as Empresas Filhas';
    exportarRepassePDF(itensExport, modo, periodoTexto, empresaTitulo);
  };

  // Estilos reutilizáveis
  const surfaceBg = isDark ? '#111827' : '#ffffff';
  const borderCol = isDark ? '#1f2937' : '#e2e8f0';
  const headBg = isDark ? '#0b0f19' : '#f8fafc';

  const itensNaoRecebidosNoModal = itensParaRepassar.filter(i => !i.recebidaAdm);

  // Estado vazio quando não há empresas filhas configuradas
  if (empresasFilhasVisiveis.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 4,
          border: `1px solid ${borderCol}`,
          bgcolor: surfaceBg,
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', mb: 1 }}>
          Nenhuma empresa filha vinculada
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto' }}>
          Para controlar os repasses de comissão, cadastre as empresas parceiras (ex: Shazam, Winvest, Vertex)
          em <strong>Configurações → Empresas</strong> vinculando-as à empresa mãe (ex: InvestCon Master).
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header da Tela */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              Repasse de Comissões às Empresas
            </Typography>
            {!podeGerenciar && (
              <Chip
                icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                label="Somente Leitura"
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(99, 102, 241, 0.12)',
                  color: '#818cf8',
                  borderRadius: 1.5,
                }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.4 }}>
            {podeGerenciar
              ? 'Acompanhe as parcelas recebidas da administradora, a retenção da InvestCon Master (diferença de tabelas) e controle os repasses pagos a cada empresa filha.'
              : 'Consulte o extrato de parcelas e repasses de comissão realizados pela InvestCon Master para a sua empresa.'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
          {podeGerenciar && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleSelecionarProntas}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                borderColor: 'rgba(245, 158, 11, 0.5)',
                color: '#f59e0b',
                '&:hover': {
                  borderColor: '#f59e0b',
                  bgcolor: 'rgba(245, 158, 11, 0.08)',
                },
              }}
            >
              Selecionar Prontas ({kpis.qtdProntas})
            </Button>
          )}

          {podeGerenciar ? (
            <>
              <Button
                variant="contained"
                size="small"
                startIcon={<PictureAsPdfIcon />}
                onClick={(e) => setMenuPdfAnchor(e.currentTarget)}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                }}
              >
                Exportar PDF {itensSelecionadosObj.length > 0 ? `(${itensSelecionadosObj.length})` : ''}
              </Button>
              <Menu
                anchorEl={menuPdfAnchor}
                open={Boolean(menuPdfAnchor)}
                onClose={() => setMenuPdfAnchor(null)}
              >
                <MenuItem onClick={() => executarExportacaoPDF('extrato_filha')}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Extrato p/ Empresa Filha
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Sem exibir tabela base nem diferença da InvestCon Master
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem onClick={() => executarExportacaoPDF('gerencial_master')}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Relatório Gerencial Master
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Completo com Comissão Base, Diferença Master e Líquido Repassado
                    </Typography>
                  </Box>
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => executarExportacaoPDF('extrato_filha')}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              }}
            >
              Exportar Extrato PDF
            </Button>
          )}
        </Box>
      </Box>

      {/* Cards KPI Consolidados */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            lg: podeGerenciar ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          },
          gap: 2,
        }}
      >
        {/* KPI 1: Pronto p/ Repasse */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.4)'}`,
            bgcolor: isDark ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.04)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>
              Pronto p/ Repasse
            </Typography>
            <PaymentsIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
          </Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#f59e0b' }}
          >
            {formatarMoeda(kpis.prontoRepasse)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {kpis.qtdProntas} parcela(s) já recebida(s) da ADM
          </Typography>
        </Paper>

        {/* KPI 2: Já Repassado */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.35)'}`,
            bgcolor: isDark ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.04)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981' }}>
              Repassado às Empresas
            </Typography>
            <CheckCircleIcon sx={{ fontSize: 20, color: '#10b981' }} />
          </Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#10b981' }}
          >
            {formatarMoeda(kpis.repassado)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {kpis.qtdRepassadas} parcela(s) paga(s) no período
          </Typography>
        </Paper>

        {/* KPI 3: Aguardando ADM / Cliente */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: `1px solid ${borderCol}`,
            bgcolor: surfaceBg,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0ea5e9' }}>
              Aguardando ADM / Cliente
            </Typography>
            <HourglassEmptyIcon sx={{ fontSize: 20, color: '#0ea5e9' }} />
          </Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
          >
            {formatarMoeda(kpis.aguardando)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {kpis.qtdAguardando} parcela(s) futura(s) / em aberto
          </Typography>
        </Paper>

        {/* KPI 4: Retenção InvestCon Master (Exclusivo Master) */}
        {podeGerenciar && (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.3)'}`,
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#818cf8' }}>
                Diferença InvestCon Master
              </Typography>
              <AccountBalanceIcon sx={{ fontSize: 20, color: '#818cf8' }} />
            </Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#818cf8' }}
            >
              {formatarMoeda(kpis.diferencaMasterTotal)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Realizado ADM: {formatarMoeda(kpis.diferencaMasterRecebida)} ({kpis.percentualRetencao.toFixed(1).replace('.', ',')}% do bruto)
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Cards de Resumo Rápido por Empresa Filha (somente Master com múltiplas filhas) */}
      {podeGerenciar && resumoPorEmpresa.length > 1 && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'text.secondary', mb: 1, display: 'block' }}>
            Resumo por Empresa Filha (clique para filtrar)
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {resumoPorEmpresa.map(emp => {
              const ativa = empresaEfetivaFiltro === emp.empresaId;
              return (
                <Paper
                  key={emp.empresaId}
                  elevation={0}
                  onClick={() => setEmpresaFiltroLocal(ativa ? '' : emp.empresaId)}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: `1.5px solid ${ativa ? theme.palette.primary.main : borderCol}`,
                    bgcolor: ativa
                      ? (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.05)')
                      : surfaceBg,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <BusinessIcon sx={{ fontSize: 16, color: ativa ? 'primary.main' : 'text.secondary' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                        {emp.empresaNome}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${emp.qtdTotal} parc.`}
                      size="small"
                      sx={{ height: 19, fontSize: '0.66rem', fontWeight: 700 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                        Pronto ({emp.qtdProntas})
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                        {formatarMoeda(emp.valorProntoRepasse)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                        Repassado ({emp.qtdRepassadas})
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                        {formatarMoeda(emp.valorRepassado)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                        Dif. Master
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                        {formatarMoeda(emp.valorDiferencaMaster)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Barra de Filtros */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: `1px solid ${borderCol}`,
          bgcolor: surfaceBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Filtro por Empresa Filha */}
          {podeGerenciar && (
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Empresa Filha</InputLabel>
              <Select
                value={empresaEfetivaFiltro}
                label="Empresa Filha"
                onChange={(e) => setEmpresaFiltroLocal(e.target.value)}
                disabled={Boolean(empresaFiltroHeader && idsFilhasVisiveis.has(empresaFiltroHeader))}
              >
                <MenuItem value="">
                  <em>Todas as Empresas Filhas</em>
                </MenuItem>
                {empresasFilhasVisiveis.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Filtro por Status de Repasse */}
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Status do Repasse</InputLabel>
            <Select
              value={statusFiltro}
              label="Status do Repasse"
              onChange={(e) => setStatusFiltro(e.target.value as 'TODOS' | StatusRepasseParcela)}
            >
              <MenuItem value="TODOS">Todos os Status</MenuItem>
              <MenuItem value="Pronto p/ Repasse">Pronto p/ Repasse (Recebido ADM)</MenuItem>
              <MenuItem value="Repassada">Já Repassada à Empresa</MenuItem>
              <MenuItem value="Aguardando ADM">Aguardando ADM (Cliente Pagou)</MenuItem>
              <MenuItem value="Aguardando Cliente">Aguardando Cliente</MenuItem>
            </Select>
          </FormControl>

          {/* Critério de Data do Período Global */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={criterioData}
            onChange={(_, val) => val && setCriterioData(val)}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                px: 1.3,
              },
            }}
          >
            <ToggleButton value="vencimento">Por Vencimento</ToggleButton>
            <ToggleButton value="recebimento_adm">Por Rec. ADM</ToggleButton>
            <ToggleButton value="repasse">Por Dt. Repasse</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Busca Textual */}
        <TextField
          size="small"
          placeholder="Buscar cliente, PAC, tabela, comprovante..."
          value={buscaTexto}
          onChange={(e) => setBuscaTexto(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 280 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: buscaTexto ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setBuscaTexto('')} edge="end">
                    <ClearIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Paper>

      {/* Barra de Ações em Lote (quando houver seleção e permissão) */}
      {podeGerenciar && itensSelecionadosObj.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            px: 2.5,
            py: 1.5,
            borderRadius: 3,
            border: `1.5px solid ${theme.palette.primary.main}`,
            bgcolor: isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(99, 102, 241, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            position: 'sticky',
            top: 76,
            zIndex: 20,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`${itensSelecionadosObj.length} selecionada(s)`}
              color="primary"
              size="small"
              sx={{ fontWeight: 800 }}
            />
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              Total Líquido a Repassar:{' '}
              <Box component="span" sx={{ color: '#10b981', fontWeight: 800 }}>
                {formatarMoeda(
                  itensSelecionadosObj
                    .filter(i => !i.repassePago)
                    .reduce((s, i) => s + i.comissaoFilha, 0)
                )}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {itensSelecionadosObj.some(i => !i.repassePago) && (
              <Button
                variant="contained"
                size="small"
                color="success"
                startIcon={<PaymentsIcon />}
                onClick={() => abrirModalRepasse(itensSelecionadosObj)}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Registrar Repasse ({itensSelecionadosObj.filter(i => !i.repassePago).length})
              </Button>
            )}
            {itensSelecionadosObj.some(i => i.repassePago) && (
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => setItensParaDesfazer(itensSelecionadosObj.filter(i => i.repassePago))}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Desfazer Repasse ({itensSelecionadosObj.filter(i => i.repassePago).length})
              </Button>
            )}
            <Button
              size="small"
              variant="text"
              onClick={() => setSelecionadas([])}
              sx={{ color: 'text.secondary', fontWeight: 600 }}
            >
              Limpar Seleção
            </Button>
          </Box>
        </Paper>
      )}

      {/* Listagem Agrupada por Mês */}
      {gruposPorMes.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            border: `1px solid ${borderCol}`,
            bgcolor: surfaceBg,
          }}
        >
          <ReceiptLongIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', mb: 0.5 }}>
            Nenhuma parcela encontrada neste período
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ajuste o período no topo da tela, o critério de data ou os filtros de empresa e status.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {gruposPorMes.map(grupo => {
            const aberto = !mesesRecolhidos[grupo.mesChave];
            const idsGrupo = grupo.itens.map(i => i.id);
            const todosSelecionados = idsGrupo.length > 0 && idsGrupo.every(id => selecionadas.includes(id));
            const algunsSelecionados = idsGrupo.some(id => selecionadas.includes(id)) && !todosSelecionados;

            return (
              <Paper
                key={grupo.mesChave}
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: `1px solid ${borderCol}`,
                  bgcolor: surfaceBg,
                  overflow: 'hidden',
                }}
              >
                {/* Cabeçalho do Mês */}
                <Box
                  onClick={() =>
                    setMesesRecolhidos(prev => ({ ...prev, [grupo.mesChave]: !prev[grupo.mesChave] }))
                  }
                  sx={{
                    px: 2.5,
                    py: 1.6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    cursor: 'pointer',
                    bgcolor: headBg,
                    borderBottom: aberto ? `1px solid ${borderCol}` : 'none',
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <IconButton size="small" sx={{ p: 0.3 }}>
                      {aberto ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                      {formatarMesAno(grupo.mesChave)}
                    </Typography>
                    <Chip
                      label={`${grupo.itens.length} parcela(s)`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                    {podeGerenciar && (
                      <>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.64rem', display: 'block' }}>
                            Base ADM
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {formatarMoeda(grupo.totalBase)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: '#818cf8', fontSize: '0.64rem', display: 'block', fontWeight: 700 }}>
                            Dif. Master
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                            {formatarMoeda(grupo.totalDiferencaMaster)}
                          </Typography>
                        </Box>
                      </>
                    )}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#f59e0b', fontSize: '0.64rem', display: 'block', fontWeight: 700 }}>
                        Pronto ({grupo.qtdProntas})
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                        {formatarMoeda(grupo.totalProntoRepasse)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#10b981', fontSize: '0.64rem', display: 'block', fontWeight: 700 }}>
                        Repassado ({grupo.qtdRepassadas})
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                        {formatarMoeda(grupo.totalRepassado)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Tabela de Parcelas do Mês */}
                <Collapse in={aberto} timeout="auto" unmountOnExit>
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: isDark ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc' }}>
                          {podeGerenciar && (
                            <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                              <Checkbox
                                size="small"
                                checked={todosSelecionados}
                                indeterminate={algunsSelecionados}
                                onChange={(e) => toggleSelecionarGrupo(idsGrupo, e.target.checked)}
                              />
                            </TableCell>
                          )}
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Empresa
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Cliente / PAC
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Tabela / Parc.
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Vencimento
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Rec. ADM
                          </TableCell>
                          {podeGerenciar && (
                            <>
                              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                                Base (ADM)
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: '#818cf8' }}>
                                Dif. Master
                              </TableCell>
                            </>
                          )}
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: '#10b981' }}>
                            Repasse Empresa
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Status Repasse
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Ref. / Comprovante
                          </TableCell>
                          {podeGerenciar && (
                            <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                              Ação
                            </TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {grupo.itens.map(item => {
                          const isSelected = selecionadas.includes(item.id);
                          return (
                            <TableRow
                              key={item.id}
                              hover
                              selected={isSelected}
                              sx={{
                                '&:last-child td': { border: 0 },
                                bgcolor: item.statusRepasse === 'Pronto p/ Repasse'
                                  ? (isDark ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.03)')
                                  : undefined,
                              }}
                            >
                              {podeGerenciar && (
                                <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                  <Checkbox
                                    size="small"
                                    checked={isSelected}
                                    onChange={() => toggleSelecionarItem(item.id)}
                                  />
                                </TableCell>
                              )}

                              {/* Empresa */}
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Chip
                                  label={item.empresaNome}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: 1.5,
                                    bgcolor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                                    color: '#f59e0b',
                                  }}
                                />
                              </TableCell>

                              {/* Cliente / PAC */}
                              <TableCell sx={{ minWidth: 190 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                                  {item.cliente}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                                  {item.pac ? `PAC: ${item.pac}` : 'Sem PAC'} · {item.administradoraNome}
                                </Typography>
                              </TableCell>

                              {/* Tabela / Parcela */}
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="body2" sx={{ fontSize: '0.74rem', fontWeight: 600 }}>
                                  {item.tabela}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem' }}>
                                  Parcela {item.parcelaIndex}/{item.qtdParcelas} · Cota {formatarMoeda(item.valorVenda)}
                                </Typography>
                              </TableCell>

                              {/* Vencimento */}
                              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                                {formatarData(item.dataVencimento)}
                              </TableCell>

                              {/* Recebimento ADM */}
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {item.recebidaAdm ? (
                                  <Tooltip title={item.numeroRelatorioAdm ? `Relatório ADM: ${item.numeroRelatorioAdm}` : 'Comissão recebida da administradora'}>
                                    <Chip
                                      icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                                      label={item.dataRecebimentoAdm ? formatarData(item.dataRecebimentoAdm) : 'Recebida'}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        bgcolor: 'rgba(14, 165, 233, 0.12)',
                                        color: '#0ea5e9',
                                      }}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
                                    Pendente
                                  </Typography>
                                )}
                              </TableCell>

                              {/* Comissão Base + Diferença Master (Exclusivo Master) */}
                              {podeGerenciar && (
                                <>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '0.76rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatarMoeda(item.comissaoBase)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '0.76rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: item.diferencaMaster > 0 ? '#818cf8' : 'text.disabled' }}>
                                    {item.diferencaMaster > 0 ? formatarMoeda(item.diferencaMaster) : '—'}
                                  </TableCell>
                                </>
                              )}

                              {/* Valor Repasse Empresa Filha */}
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>
                                {formatarMoeda(item.comissaoFilha)}
                              </TableCell>

                              {/* Status Repasse */}
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <StatusRepasseBadge status={item.statusRepasse} dataRepasse={item.dataRepasse} />
                              </TableCell>

                              {/* Referência / Comprovante */}
                              <TableCell sx={{ maxWidth: 160 }}>
                                {item.comprovanteRepasse || item.observacaoRepasse ? (
                                  <Tooltip title={item.observacaoRepasse || item.comprovanteRepasse || ''}>
                                    <Box>
                                      {item.comprovanteRepasse && (
                                        <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                                          {item.comprovanteRepasse}
                                        </Typography>
                                      )}
                                      {item.observacaoRepasse && (
                                        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', fontSize: '0.64rem' }}>
                                          {item.observacaoRepasse}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                                )}
                              </TableCell>

                              {/* Ação Individual */}
                              {podeGerenciar && (
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                  {!item.repassePago ? (
                                    <Tooltip
                                      title={
                                        item.recebidaAdm
                                          ? 'Registrar repasse pago para a empresa'
                                          : 'Atenção: ainda não recebida da ADM (clique para repassar mesmo assim)'
                                      }
                                    >
                                      <Button
                                        size="small"
                                        variant={item.recebidaAdm ? 'contained' : 'outlined'}
                                        color={item.recebidaAdm ? 'success' : 'warning'}
                                        onClick={() => abrirModalRepasse([item])}
                                        sx={{
                                          minWidth: 0,
                                          px: 1.2,
                                          py: 0.3,
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          borderRadius: 1.5,
                                        }}
                                      >
                                        Pagar
                                      </Button>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip title="Desfazer repasse">
                                      <IconButton
                                        size="small"
                                        color="warning"
                                        onClick={() => setItensParaDesfazer([item])}
                                      >
                                        <UndoIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Modal: Registrar Repasse (Individual ou Lote) */}
      <Dialog
        open={modalRepasseAberto}
        onClose={() => setModalRepasseAberto(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3.5,
              bgcolor: surfaceBg,
              border: `1px solid ${borderCol}`,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Registrar Repasse às Empresas
          <IconButton size="small" onClick={() => setModalRepasseAberto(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.2}>
            {/* Alerta se houver parcelas não recebidas da ADM */}
            {itensNaoRecebidosNoModal.length > 0 && (
              <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                sx={{ borderRadius: 2 }}
                action={
                  itensParaRepassar.length > itensNaoRecebidosNoModal.length ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setItensParaRepassar(prev => prev.filter(i => i.recebidaAdm))}
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Remover pendentes
                    </Button>
                  ) : undefined
                }
              >
                <strong>{itensNaoRecebidosNoModal.length} parcela(s)</strong> selecionada(s) ainda{' '}
                <strong>não constam como recebidas da administradora</strong>. Confirme apenas se deseja adiantar o repasse.
              </Alert>
            )}

            {/* Resumo Financeiro do Lote */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: '#10b981', display: 'block', mb: 1 }}>
                Resumo do Repasse ({itensParaRepassar.length} parcela(s))
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Base (ADM)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatarMoeda(itensParaRepassar.reduce((s, i) => s + i.comissaoBase, 0))}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#818cf8', display: 'block', fontWeight: 600 }}>
                    Diferença Master
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>
                    {formatarMoeda(itensParaRepassar.reduce((s, i) => s + i.diferencaMaster, 0))}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#10b981', display: 'block', fontWeight: 700 }}>
                    Líquido a Repassar
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                    {formatarMoeda(itensParaRepassar.reduce((s, i) => s + i.comissaoFilha, 0))}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 1.2 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Empresas:{' '}
                <strong>
                  {Array.from(new Set(itensParaRepassar.map(i => i.empresaNome))).join(', ')}
                </strong>
              </Typography>
            </Paper>

            <TextField
              label="Data do Repasse"
              type="date"
              size="small"
              fullWidth
              value={dataRepasseInput}
              onChange={(e) => setDataRepasseInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              label="Referência / Nº Comprovante / Lote (opcional)"
              size="small"
              fullWidth
              placeholder="Ex: PIX 27/11, TED Banco Inter, Lote #04..."
              value={comprovanteInput}
              onChange={(e) => setComprovanteInput(e.target.value)}
            />

            <TextField
              label="Observação (opcional)"
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Anotações internas sobre este pagamento..."
              value={observacaoInput}
              onChange={(e) => setObservacaoInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setModalRepasseAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleConfirmarRepasse}
            disabled={itensParaRepassar.length === 0}
          >
            Confirmar Repasse Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Confirmar Estorno / Desfazer Repasse */}
      <Dialog
        open={itensParaDesfazer.length > 0}
        onClose={() => setItensParaDesfazer([])}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
          Desfazer Repasse
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Deseja realmente remover a marcação de repasse pago de{' '}
            <strong>{itensParaDesfazer.length} parcela(s)</strong> (
            {formatarMoeda(itensParaDesfazer.reduce((s, i) => s + i.comissaoFilha, 0))})?
            Elas voltarão ao status anterior (Pronto p/ Repasse ou Aguardando).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setItensParaDesfazer([])}>
            Cancelar
          </Button>
          <Button variant="contained" color="warning" onClick={handleConfirmarDesfazer}>
            Confirmar Estorno
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};
