import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { cor } from "../../../src/ui/tema";
import { useLayout } from "../../../src/ui/layout";
import { TourGuiado } from "../../../src/features/tour/TourGuiado";

type NomeIcone = keyof typeof Ionicons.glyphMap;

const ABAS: { nome: string; titulo: string; icone: NomeIcone }[] = [
  { nome: "index", titulo: "Central", icone: "home" },
  { nome: "mentor", titulo: "Mentor", icone: "chatbubbles" },
  { nome: "quiz", titulo: "Quiz", icone: "help-circle" },
  { nome: "ligas", titulo: "Ligas", icone: "trophy" },
  { nome: "mais", titulo: "Mais", icone: "grid" },
];

/**
 * As mesmas cinco entradas da barra inferior do web (Central, Mentor,
 * Quiz, Ligas, Mais). A partir de 820px (tablet) a barra vai para a
 * lateral: em tela larga, barra embaixo desperdiça a altura, que é o que
 * falta. Estreita no tablet, com rótulo ao lado a partir de 1024px.
 */
export default function LayoutAbas() {
  const layout = useLayout();
  const largo = layout.barraLateral;
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarPosition: largo ? "left" : "bottom",
          tabBarVariant: largo ? "material" : "uikit",
          tabBarLabelPosition: layout.rotuloAoLado ? "beside-icon" : "below-icon",
          tabBarActiveTintColor: cor.ceu600,
          tabBarInactiveTintColor: cor.tinta500,
          tabBarLabelStyle: { fontWeight: "800", fontSize: 12 },
          tabBarStyle: largo
            ? {
                width: layout.larguraBarra,
                borderRightWidth: 2,
                borderRightColor: cor.cinza200,
              }
            : {
                borderTopWidth: 2,
                borderTopColor: cor.cinza200,
                minHeight: 60,
              },
          sceneStyle: { backgroundColor: cor.branco },
        }}
      >
        {ABAS.map((a) => (
          <Tabs.Screen
            key={a.nome}
            name={a.nome}
            options={{
              title: a.titulo,
              tabBarAccessibilityLabel: a.titulo,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={a.icone} color={String(color)} size={size} />
              ),
            }}
          />
        ))}
      </Tabs>
      <TourGuiado />
    </>
  );
}
