import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cor, LARGURA_NOTEBOOK } from "../../../src/ui/tema";
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
 * Quiz, Ligas, Mais). A partir de 1024px a barra vai para a lateral: no
 * notebook, barra embaixo desperdiça a altura, que é o que falta.
 */
export default function LayoutAbas() {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_NOTEBOOK;
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarPosition: largo ? "left" : "bottom",
          tabBarVariant: largo ? "material" : "uikit",
          tabBarLabelPosition: largo ? "beside-icon" : "below-icon",
          tabBarActiveTintColor: cor.ceu600,
          tabBarInactiveTintColor: cor.tinta500,
          tabBarLabelStyle: { fontWeight: "800", fontSize: 12 },
          tabBarStyle: largo
            ? {
                width: 220,
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
