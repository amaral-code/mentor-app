/*
 * ARQUIVO GERADO. Não edite à mão.
 * Fonte: supabase/migrations (aplicadas no PGlite por supabase/bancoLocal.mjs).
 * Regerar: npm run gen:types --workspace @mentor/api
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      agendamentos: {
        Row: {
          id: string
          aluno_id: string
          responsavel_id: string | null
          psicologo_id: string
          alerta_id: string | null
          inicio: string
          fim: string
          duracao_minutos: number
          meeting_url: string | null
          meeting_provider: string | null
          meeting_ref: string | null
          valor_centavos: number
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          pagamento_ref: string | null
          status: Database["public"]["Enums"]["status_agendamento"]
          observacoes: string | null
          criado_em: string
          atualizado_em: string
          reembolso: string | null
          cancelado_por: string | null
        }
        Insert: {
          id?: string
          aluno_id: string
          responsavel_id?: string | null
          psicologo_id: string
          alerta_id?: string | null
          inicio: string
          fim: string
          duracao_minutos?: number
          meeting_url?: string | null
          meeting_provider?: string | null
          meeting_ref?: string | null
          valor_centavos?: number
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          pagamento_ref?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
          observacoes?: string | null
          criado_em?: string
          atualizado_em?: string
          reembolso?: string | null
          cancelado_por?: string | null
        }
        Update: {
          id?: string
          aluno_id?: string
          responsavel_id?: string | null
          psicologo_id?: string
          alerta_id?: string | null
          inicio?: string
          fim?: string
          duracao_minutos?: number
          meeting_url?: string | null
          meeting_provider?: string | null
          meeting_ref?: string | null
          valor_centavos?: number
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          pagamento_ref?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
          observacoes?: string | null
          criado_em?: string
          atualizado_em?: string
          reembolso?: string | null
          cancelado_por?: string | null
        }
        Relationships: []
      }
      alertas_saude_mental: {
        Row: {
          id: string
          aluno_id: string
          tipo: string
          severidade: Database["public"]["Enums"]["severidade_alerta"]
          score: number
          gatilho: Json
          mensagem: string
          status: Database["public"]["Enums"]["status_alerta"]
          criado_em: string
          visto_em: string | null
          resolvido_em: string | null
        }
        Insert: {
          id?: string
          aluno_id: string
          tipo: string
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          score?: number
          gatilho?: Json
          mensagem: string
          status?: Database["public"]["Enums"]["status_alerta"]
          criado_em?: string
          visto_em?: string | null
          resolvido_em?: string | null
        }
        Update: {
          id?: string
          aluno_id?: string
          tipo?: string
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          score?: number
          gatilho?: Json
          mensagem?: string
          status?: Database["public"]["Enums"]["status_alerta"]
          criado_em?: string
          visto_em?: string | null
          resolvido_em?: string | null
        }
        Relationships: []
      }
      assinaturas_escolas: {
        Row: {
          id: string
          escola_id: string
          pagador_id: string | null
          email_pagador: string
          status_pagamento: string
          expira_em: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          escola_id: string
          pagador_id?: string | null
          email_pagador: string
          status_pagamento?: string
          expira_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          escola_id?: string
          pagador_id?: string | null
          email_pagador?: string
          status_pagamento?: string
          expira_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      avaliacoes_psicologo: {
        Row: {
          id: string
          agendamento_id: string
          psicologo_id: string
          autor_id: string
          nota: number
          comentario: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          agendamento_id: string
          psicologo_id: string
          autor_id: string
          nota: number
          comentario?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          agendamento_id?: string
          psicologo_id?: string
          autor_id?: string
          nota?: number
          comentario?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      carteira_foco: {
        Row: {
          user_id: string
          saldo: number
          total_ganho: number
          total_gasto: number
          atualizado_em: string
        }
        Insert: {
          user_id: string
          saldo?: number
          total_ganho?: number
          total_gasto?: number
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          saldo?: number
          total_ganho?: number
          total_gasto?: number
          atualizado_em?: string
        }
        Relationships: []
      }
      chat_mensagens: {
        Row: {
          id: number
          user_id: string
          papel: string
          texto: string
          humor: Database["public"]["Enums"]["humor_tipo"] | null
          imagem: string | null
          criado_em: string
          conversa_id: string | null
        }
        Insert: {
          id?: number
          user_id: string
          papel: string
          texto: string
          humor?: Database["public"]["Enums"]["humor_tipo"] | null
          imagem?: string | null
          criado_em?: string
          conversa_id?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          papel?: string
          texto?: string
          humor?: Database["public"]["Enums"]["humor_tipo"] | null
          imagem?: string | null
          criado_em?: string
          conversa_id?: string | null
        }
        Relationships: []
      }
      consentimentos_dados: {
        Row: {
          id: string
          aluno_id: string
          psicologo_id: string
          concedido_por: string
          escopo: string[]
          valido_ate: string
          revogado_em: string | null
          revogado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          aluno_id: string
          psicologo_id: string
          concedido_por: string
          escopo: string[]
          valido_ate: string
          revogado_em?: string | null
          revogado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          aluno_id?: string
          psicologo_id?: string
          concedido_por?: string
          escopo?: string[]
          valido_ate?: string
          revogado_em?: string | null
          revogado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      contas_demo: {
        Row: {
          user_id: string
          da_equipe: boolean
          criado_em: string
        }
        Insert: {
          user_id: string
          da_equipe?: boolean
          criado_em?: string
        }
        Update: {
          user_id?: string
          da_equipe?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      conversas_chat: {
        Row: {
          id: string
          user_id: string
          titulo: string
          modo: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          user_id: string
          titulo?: string
          modo?: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          user_id?: string
          titulo?: string
          modo?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      demonstracao: {
        Row: {
          id: number
          escola_id: string
          turma_id: string
          criado_em: string
        }
        Insert: {
          id?: number
          escola_id: string
          turma_id: string
          criado_em?: string
        }
        Update: {
          id?: number
          escola_id?: string
          turma_id?: string
          criado_em?: string
        }
        Relationships: []
      }
      desafios_redacao: {
        Row: {
          id: number
          user_id: string
          tema: string
          nota_final: number
          competencia1: number
          competencia2: number
          competencia3: number
          competencia4: number
          competencia5: number
          xp_ganho: number
          tempo_usado_segundos: number
          finalizado: boolean
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          tema: string
          nota_final: number
          competencia1?: number
          competencia2?: number
          competencia3?: number
          competencia4?: number
          competencia5?: number
          xp_ganho?: number
          tempo_usado_segundos?: number
          finalizado?: boolean
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          tema?: string
          nota_final?: number
          competencia1?: number
          competencia2?: number
          competencia3?: number
          competencia4?: number
          competencia5?: number
          xp_ganho?: number
          tempo_usado_segundos?: number
          finalizado?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      escolas: {
        Row: {
          id: string
          nome: string
          cidade: string | null
          cor: string | null
          criado_em: string
          codigo_instituicao: string | null
          limite_alunos: number | null
        }
        Insert: {
          id?: string
          nome: string
          cidade?: string | null
          cor?: string | null
          criado_em?: string
          codigo_instituicao?: string | null
          limite_alunos?: number | null
        }
        Update: {
          id?: string
          nome?: string
          cidade?: string | null
          cor?: string | null
          criado_em?: string
          codigo_instituicao?: string | null
          limite_alunos?: number | null
        }
        Relationships: []
      }
      extrato_foco: {
        Row: {
          id: number
          user_id: string
          delta: number
          motivo: string
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          delta: number
          motivo: string
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          delta?: number
          motivo?: string
          criado_em?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          chave: string
          descricao: string
          ativa: boolean
          porcentagem: number
          escolas: string[]
          atualizado_em: string
        }
        Insert: {
          chave: string
          descricao?: string
          ativa?: boolean
          porcentagem?: number
          escolas?: string[]
          atualizado_em?: string
        }
        Update: {
          chave?: string
          descricao?: string
          ativa?: boolean
          porcentagem?: number
          escolas?: string[]
          atualizado_em?: string
        }
        Relationships: []
      }
      focus_metrics: {
        Row: {
          id: string
          user_id: string
          session_date: string
          focused_minutes: number
          distraction_count: number
          criado_em: string
        }
        Insert: {
          id?: string
          user_id: string
          session_date?: string
          focused_minutes?: number
          distraction_count?: number
          criado_em?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_date?: string
          focused_minutes?: number
          distraction_count?: number
          criado_em?: string
        }
        Relationships: []
      }
      gamificacao: {
        Row: {
          user_id: string
          xp: number
          level: number
          streak: number
          ultimo_acesso: string | null
          atualizado_em: string
        }
        Insert: {
          user_id: string
          xp?: number
          level?: number
          streak?: number
          ultimo_acesso?: string | null
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          xp?: number
          level?: number
          streak?: number
          ultimo_acesso?: string | null
          atualizado_em?: string
        }
        Relationships: []
      }
      humor_historico: {
        Row: {
          id: number
          user_id: string
          humor: Database["public"]["Enums"]["humor_tipo"]
          texto: string | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          humor: Database["public"]["Enums"]["humor_tipo"]
          texto?: string | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          humor?: Database["public"]["Enums"]["humor_tipo"]
          texto?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      indice_burnout: {
        Row: {
          id: number
          user_id: string
          data: string
          score: number
          classe: Database["public"]["Enums"]["classe_burnout"]
          features: Json
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          data: string
          score: number
          classe?: Database["public"]["Enums"]["classe_burnout"]
          features?: Json
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          data?: string
          score?: number
          classe?: Database["public"]["Enums"]["classe_burnout"]
          features?: Json
          criado_em?: string
        }
        Relationships: []
      }
      inventario: {
        Row: {
          id: number
          user_id: string
          item_id: string
          equipado: boolean
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          item_id: string
          equipado?: boolean
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          item_id?: string
          equipado?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      liga_membros: {
        Row: {
          liga_id: string
          user_id: string
          entrou_em: string
          progresso: Json
        }
        Insert: {
          liga_id: string
          user_id: string
          entrou_em?: string
          progresso?: Json
        }
        Update: {
          liga_id?: string
          user_id?: string
          entrou_em?: string
          progresso?: Json
        }
        Relationships: []
      }
      ligas: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          criador_id: string
          codigo: string
          criado_em: string
          dados: Json
          disciplina: string | null
          xp_premio: number
          privada: boolean
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          criador_id: string
          codigo?: string
          criado_em?: string
          dados?: Json
          disciplina?: string | null
          xp_premio?: number
          privada?: boolean
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          criador_id?: string
          codigo?: string
          criado_em?: string
          dados?: Json
          disciplina?: string | null
          xp_premio?: number
          privada?: boolean
        }
        Relationships: []
      }
      log_intervencoes_ia: {
        Row: {
          id: number
          user_id: string
          tipo: string
          gatilho: Json
          mensagem: string
          aceita: boolean | null
          respondida_em: string | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          tipo: string
          gatilho?: Json
          mensagem: string
          aceita?: boolean | null
          respondida_em?: string | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          tipo?: string
          gatilho?: Json
          mensagem?: string
          aceita?: boolean | null
          respondida_em?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          id: number
          user_id: string
          tipo: Database["public"]["Enums"]["log_tipo"]
          descricao: string
          xp: number
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          tipo: Database["public"]["Enums"]["log_tipo"]
          descricao: string
          xp?: number
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          tipo?: Database["public"]["Enums"]["log_tipo"]
          descricao?: string
          xp?: number
          criado_em?: string
        }
        Relationships: []
      }
      loja_itens: {
        Row: {
          id: string
          nome: string
          preco: number
          ativo: boolean
          criado_em: string
        }
        Insert: {
          id: string
          nome: string
          preco: number
          ativo?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          preco?: number
          ativo?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      mensagens_apoio: {
        Row: {
          id: string
          psicologo_id: string
          participante_id: string
          autor_id: string
          texto: string
          criado_em: string
          lida_em: string | null
        }
        Insert: {
          id?: string
          psicologo_id: string
          participante_id: string
          autor_id: string
          texto: string
          criado_em?: string
          lida_em?: string | null
        }
        Update: {
          id?: string
          psicologo_id?: string
          participante_id?: string
          autor_id?: string
          texto?: string
          criado_em?: string
          lida_em?: string | null
        }
        Relationships: []
      }
      mensagens_comunidade: {
        Row: {
          id: number
          turma_id: string | null
          escola_id: string | null
          autor_id: string
          conteudo: string
          criado_em: string
          materia: string | null
          moderada: boolean
          motivo_mod: string | null
          responde_a: number | null
          curtido_por: string[]
        }
        Insert: {
          id?: number
          turma_id?: string | null
          escola_id?: string | null
          autor_id: string
          conteudo: string
          criado_em?: string
          materia?: string | null
          moderada?: boolean
          motivo_mod?: string | null
          responde_a?: number | null
          curtido_por?: string[]
        }
        Update: {
          id?: number
          turma_id?: string | null
          escola_id?: string | null
          autor_id?: string
          conteudo?: string
          criado_em?: string
          materia?: string | null
          moderada?: boolean
          motivo_mod?: string | null
          responde_a?: number | null
          curtido_por?: string[]
        }
        Relationships: []
      }
      modulos_audio: {
        Row: {
          id: string
          materia: string
          topico: string
          titulo: string
          resumo: string | null
          roteiro: string
          audio_url: string | null
          duracao_segundos: number
          voz: string | null
          publico: boolean
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          materia: string
          topico: string
          titulo: string
          resumo?: string | null
          roteiro: string
          audio_url?: string | null
          duracao_segundos?: number
          voz?: string | null
          publico?: boolean
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          materia?: string
          topico?: string
          titulo?: string
          resumo?: string | null
          roteiro?: string
          audio_url?: string | null
          duracao_segundos?: number
          voz?: string | null
          publico?: boolean
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          id: number
          user_id: string
          texto: string
          tag: string | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          texto: string
          tag?: string | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          texto?: string
          tag?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          id: string
          user_id: string
          canal: Database["public"]["Enums"]["canal_notificacao"]
          tipo: string
          titulo: string
          corpo: string
          payload: Json
          lida: boolean
          enviada_em: string | null
          tentativas: number
          criado_em: string
          descartada: string | null
        }
        Insert: {
          id?: string
          user_id: string
          canal?: Database["public"]["Enums"]["canal_notificacao"]
          tipo: string
          titulo: string
          corpo: string
          payload?: Json
          lida?: boolean
          enviada_em?: string | null
          tentativas?: number
          criado_em?: string
          descartada?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          canal?: Database["public"]["Enums"]["canal_notificacao"]
          tipo?: string
          titulo?: string
          corpo?: string
          payload?: Json
          lida?: boolean
          enviada_em?: string | null
          tentativas?: number
          criado_em?: string
          descartada?: string | null
        }
        Relationships: []
      }
      operacoes_sincronizadas: {
        Row: {
          user_id: string
          chave: string
          tipo: string
          aplicada_em: string
        }
        Insert: {
          user_id: string
          chave: string
          tipo: string
          aplicada_em?: string
        }
        Update: {
          user_id?: string
          chave?: string
          tipo?: string
          aplicada_em?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          id: string
          email: string
          nome: string
          sobrenome: string | null
          papel: Database["public"]["Enums"]["papel_usuario"]
          escola_id: string | null
          turma_id: string | null
          meta_estudo: string | null
          email_responsaveis: string | null
          avatar_url: string | null
          criado_em: string
          atualizado_em: string
          deve_trocar_senha: boolean
          onboarding_completed: boolean
          metas_estudo: string[]
          tempo_diario_estudo: string | null
          turno_estudo: string | null
          data_nascimento: string | null
          codigo_vinculo: string | null
        }
        Insert: {
          id: string
          email: string
          nome: string
          sobrenome?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"]
          escola_id?: string | null
          turma_id?: string | null
          meta_estudo?: string | null
          email_responsaveis?: string | null
          avatar_url?: string | null
          criado_em?: string
          atualizado_em?: string
          deve_trocar_senha?: boolean
          onboarding_completed?: boolean
          metas_estudo?: string[]
          tempo_diario_estudo?: string | null
          turno_estudo?: string | null
          data_nascimento?: string | null
          codigo_vinculo?: string | null
        }
        Update: {
          id?: string
          email?: string
          nome?: string
          sobrenome?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"]
          escola_id?: string | null
          turma_id?: string | null
          meta_estudo?: string | null
          email_responsaveis?: string | null
          avatar_url?: string | null
          criado_em?: string
          atualizado_em?: string
          deve_trocar_senha?: boolean
          onboarding_completed?: boolean
          metas_estudo?: string[]
          tempo_diario_estudo?: string | null
          turno_estudo?: string | null
          data_nascimento?: string | null
          codigo_vinculo?: string | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          id: number
          user_id: string
          nome: string
          icone: string | null
          cor: string | null
          instrucao: string
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          nome: string
          icone?: string | null
          cor?: string | null
          instrucao: string
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          nome?: string
          icone?: string | null
          cor?: string | null
          instrucao?: string
          criado_em?: string
        }
        Relationships: []
      }
      planos_diarios: {
        Row: {
          id: number
          user_id: string
          data: string
          humor: Database["public"]["Enums"]["humor_tipo"] | null
          tarefas: Json
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          data: string
          humor?: Database["public"]["Enums"]["humor_tipo"] | null
          tarefas?: Json
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          data?: string
          humor?: Database["public"]["Enums"]["humor_tipo"] | null
          tarefas?: Json
          criado_em?: string
        }
        Relationships: []
      }
      preferencias: {
        Row: {
          user_id: string
          daltonismo: string
          tutorial_completo: boolean
          desafio_tutorial: boolean
          persona_ativa_id: string | null
          mudo: boolean
          atualizado_em: string
        }
        Insert: {
          user_id: string
          daltonismo?: string
          tutorial_completo?: boolean
          desafio_tutorial?: boolean
          persona_ativa_id?: string | null
          mudo?: boolean
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          daltonismo?: string
          tutorial_completo?: boolean
          desafio_tutorial?: boolean
          persona_ativa_id?: string | null
          mudo?: boolean
          atualizado_em?: string
        }
        Relationships: []
      }
      preferencias_notificacao: {
        Row: {
          user_id: string
          tipos: Json
          silencio_inicio: number
          silencio_fim: number
          limite_diario: number
          atualizado_em: string
        }
        Insert: {
          user_id: string
          tipos?: Json
          silencio_inicio?: number
          silencio_fim?: number
          limite_diario?: number
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          tipos?: Json
          silencio_inicio?: number
          silencio_fim?: number
          limite_diario?: number
          atualizado_em?: string
        }
        Relationships: []
      }
      progresso_audio: {
        Row: {
          user_id: string
          modulo_id: string
          segundos_ouvidos: number
          concluido: boolean
          ouvido_em: string | null
          atualizado_em: string
        }
        Insert: {
          user_id: string
          modulo_id: string
          segundos_ouvidos?: number
          concluido?: boolean
          ouvido_em?: string | null
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          modulo_id?: string
          segundos_ouvidos?: number
          concluido?: boolean
          ouvido_em?: string | null
          atualizado_em?: string
        }
        Relationships: []
      }
      prontuario_notas: {
        Row: {
          id: string
          psicologo_id: string
          aluno_id: string
          agendamento_id: string | null
          tipo: string
          retifica_id: string | null
          texto: string
          criado_em: string
        }
        Insert: {
          id?: string
          psicologo_id: string
          aluno_id: string
          agendamento_id?: string | null
          tipo?: string
          retifica_id?: string | null
          texto: string
          criado_em?: string
        }
        Update: {
          id?: string
          psicologo_id?: string
          aluno_id?: string
          agendamento_id?: string | null
          tipo?: string
          retifica_id?: string | null
          texto?: string
          criado_em?: string
        }
        Relationships: []
      }
      psicologo_disponibilidade: {
        Row: {
          id: number
          psicologo_id: string
          dia_semana: number
          hora_inicio: string
          hora_fim: string
          criado_em: string
        }
        Insert: {
          id?: number
          psicologo_id: string
          dia_semana: number
          hora_inicio: string
          hora_fim: string
          criado_em?: string
        }
        Update: {
          id?: number
          psicologo_id?: string
          dia_semana?: number
          hora_inicio?: string
          hora_fim?: string
          criado_em?: string
        }
        Relationships: []
      }
      psicologos: {
        Row: {
          id: string
          crp: string
          bio: string | null
          especialidades: string[]
          abordagem: string | null
          valor_centavos: number
          duracao_minutos: number
          foto_url: string | null
          aceita_novos: boolean
          atende_adolescente: boolean
          nota_media: number
          total_atendimentos: number
          fuso: string
          criado_em: string
          total_avaliacoes: number
          crp_verificado_em: string | null
        }
        Insert: {
          id: string
          crp: string
          bio?: string | null
          especialidades?: string[]
          abordagem?: string | null
          valor_centavos?: number
          duracao_minutos?: number
          foto_url?: string | null
          aceita_novos?: boolean
          atende_adolescente?: boolean
          nota_media?: number
          total_atendimentos?: number
          fuso?: string
          criado_em?: string
          total_avaliacoes?: number
          crp_verificado_em?: string | null
        }
        Update: {
          id?: string
          crp?: string
          bio?: string | null
          especialidades?: string[]
          abordagem?: string | null
          valor_centavos?: number
          duracao_minutos?: number
          foto_url?: string | null
          aceita_novos?: boolean
          atende_adolescente?: boolean
          nota_media?: number
          total_atendimentos?: number
          fuso?: string
          criado_em?: string
          total_avaliacoes?: number
          crp_verificado_em?: string | null
        }
        Relationships: []
      }
      push_assinaturas: {
        Row: {
          id: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      push_inscricoes: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          criado_em: string
          ultimo_uso_em: string | null
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          criado_em?: string
          ultimo_uso_em?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          criado_em?: string
          ultimo_uso_em?: string | null
        }
        Relationships: []
      }
      quiz_desempenho_topicos: {
        Row: {
          id: number
          user_id: string
          materia: string
          topico: string
          acertos: number
          erros: number
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          materia: string
          topico?: string
          acertos?: number
          erros?: number
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          materia?: string
          topico?: string
          acertos?: number
          erros?: number
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      quiz_questoes_exibidas: {
        Row: {
          id: number
          user_id: string
          materia: string
          topico: string | null
          enunciado_hash: string
          enunciado_preview: string
          dificuldade: string
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          materia: string
          topico?: string | null
          enunciado_hash: string
          enunciado_preview: string
          dificuldade?: string
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          materia?: string
          topico?: string | null
          enunciado_hash?: string
          enunciado_preview?: string
          dificuldade?: string
          criado_em?: string
        }
        Relationships: []
      }
      quiz_resultados: {
        Row: {
          id: number
          user_id: string
          materia: string
          acertos: number
          total: number
          xp_ganho: number
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          materia: string
          acertos: number
          total: number
          xp_ganho?: number
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          materia?: string
          acertos?: number
          total?: number
          xp_ganho?: number
          criado_em?: string
        }
        Relationships: []
      }
      redacoes: {
        Row: {
          id: number
          user_id: string
          tema: string | null
          nota_final: number
          competencia1: number
          competencia2: number
          competencia3: number
          competencia4: number
          competencia5: number
          pontos_fortes: string[]
          pontos_melhorar: string[]
          texto_original: string | null
          criado_em: string
          origem: string
          imagem_path: string | null
          transcricao: string | null
          feedback_competencias: Json
          tema_detectado: string | null
        }
        Insert: {
          id?: number
          user_id: string
          tema?: string | null
          nota_final: number
          competencia1: number
          competencia2: number
          competencia3: number
          competencia4: number
          competencia5: number
          pontos_fortes?: string[]
          pontos_melhorar?: string[]
          texto_original?: string | null
          criado_em?: string
          origem?: string
          imagem_path?: string | null
          transcricao?: string | null
          feedback_competencias?: Json
          tema_detectado?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          tema?: string | null
          nota_final?: number
          competencia1?: number
          competencia2?: number
          competencia3?: number
          competencia4?: number
          competencia5?: number
          pontos_fortes?: string[]
          pontos_melhorar?: string[]
          texto_original?: string | null
          criado_em?: string
          origem?: string
          imagem_path?: string | null
          transcricao?: string | null
          feedback_competencias?: Json
          tema_detectado?: string | null
        }
        Relationships: []
      }
      relatorios_semanais: {
        Row: {
          id: number
          user_id: string
          semana_inicio: string
          texto_gerado: string
          metricas: Json
          gatilho_em: string
          lido: boolean
          lido_em: string | null
        }
        Insert: {
          id?: number
          user_id: string
          semana_inicio: string
          texto_gerado: string
          metricas?: Json
          gatilho_em?: string
          lido?: boolean
          lido_em?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          semana_inicio?: string
          texto_gerado?: string
          metricas?: Json
          gatilho_em?: string
          lido?: boolean
          lido_em?: string | null
        }
        Relationships: []
      }
      revisoes_espacadas: {
        Row: {
          id: number
          user_id: string
          topico_id: string
          topico_nome: string
          materia: string | null
          nivel_memoria: number
          intervalo_dias: number
          facilidade: number
          ultima_nota: number | null
          revisoes_feitas: number
          proxima_revisao: string
          ultima_revisao: string | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          topico_id: string
          topico_nome: string
          materia?: string | null
          nivel_memoria?: number
          intervalo_dias?: number
          facilidade?: number
          ultima_nota?: number | null
          revisoes_feitas?: number
          proxima_revisao: string
          ultima_revisao?: string | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          topico_id?: string
          topico_nome?: string
          materia?: string | null
          nivel_memoria?: number
          intervalo_dias?: number
          facilidade?: number
          ultima_nota?: number | null
          revisoes_feitas?: number
          proxima_revisao?: string
          ultima_revisao?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      sala_foco_presenca: {
        Row: {
          user_id: string
          escola_id: string | null
          materia: string
          minutos_foco: number
          entrou_em: string
          ultimo_ping: string
        }
        Insert: {
          user_id: string
          escola_id?: string | null
          materia?: string
          minutos_foco?: number
          entrou_em?: string
          ultimo_ping?: string
        }
        Update: {
          user_id?: string
          escola_id?: string | null
          materia?: string
          minutos_foco?: number
          entrou_em?: string
          ultimo_ping?: string
        }
        Relationships: []
      }
      sessoes_foco: {
        Row: {
          id: number
          user_id: string
          tipo: string
          duracao_minutos: number
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          tipo: string
          duracao_minutos: number
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          tipo?: string
          duracao_minutos?: number
          criado_em?: string
        }
        Relationships: []
      }
      sessoes_offline: {
        Row: {
          id: number
          user_id: string
          inicio: string
          fim: string
          minutos_offline: number
          interrupcoes: number
          modo: string
          moedas_creditadas: number
          validada: boolean
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          inicio: string
          fim: string
          minutos_offline: number
          interrupcoes?: number
          modo?: string
          moedas_creditadas?: number
          validada?: boolean
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          inicio?: string
          fim?: string
          minutos_offline?: number
          interrupcoes?: number
          modo?: string
          moedas_creditadas?: number
          validada?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      telemetria_estudo: {
        Row: {
          id: number
          user_id: string
          question_id: string
          materia: string | null
          dificuldade: string | null
          tempo_gasto_segundos: number
          acertou: boolean
          hora_local: number | null
          criado_em: string
        }
        Insert: {
          id?: number
          user_id: string
          question_id: string
          materia?: string | null
          dificuldade?: string | null
          tempo_gasto_segundos: number
          acertou: boolean
          hora_local?: number | null
          criado_em?: string
        }
        Update: {
          id?: number
          user_id?: string
          question_id?: string
          materia?: string | null
          dificuldade?: string | null
          tempo_gasto_segundos?: number
          acertou?: boolean
          hora_local?: number | null
          criado_em?: string
        }
        Relationships: []
      }
      turma_professores: {
        Row: {
          turma_id: string
          professor_id: string
          criado_em: string
          criado_por: string | null
        }
        Insert: {
          turma_id: string
          professor_id: string
          criado_em?: string
          criado_por?: string | null
        }
        Update: {
          turma_id?: string
          professor_id?: string
          criado_em?: string
          criado_por?: string | null
        }
        Relationships: []
      }
      turmas: {
        Row: {
          id: string
          escola_id: string
          nome: string
          ano: string | null
          criado_em: string
          codigo: string | null
        }
        Insert: {
          id?: string
          escola_id: string
          nome: string
          ano?: string | null
          criado_em?: string
          codigo?: string | null
        }
        Update: {
          id?: string
          escola_id?: string
          nome?: string
          ano?: string | null
          criado_em?: string
          codigo?: string | null
        }
        Relationships: []
      }
      vinculos_responsavel: {
        Row: {
          id: string
          responsavel_id: string
          aluno_id: string
          parentesco: string | null
          status: Database["public"]["Enums"]["status_vinculo"]
          criado_em: string
          respondido_em: string | null
        }
        Insert: {
          id?: string
          responsavel_id: string
          aluno_id: string
          parentesco?: string | null
          status?: Database["public"]["Enums"]["status_vinculo"]
          criado_em?: string
          respondido_em?: string | null
        }
        Update: {
          id?: string
          responsavel_id?: string
          aluno_id?: string
          parentesco?: string | null
          status?: Database["public"]["Enums"]["status_vinculo"]
          criado_em?: string
          respondido_em?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      catalogo_psicologos: {
        Row: {
          id: string | null
          nome: string | null
          avatar_url: string | null
          crp: string | null
          bio: string | null
          especialidades: string[] | null
          abordagem: string | null
          valor_centavos: number | null
          duracao_minutos: number | null
          foto_url: string | null
          aceita_novos: boolean | null
          atende_adolescente: boolean | null
          nota_media: number | null
          total_atendimentos: number | null
          fuso: string | null
          total_avaliacoes: number | null
        }
        Relationships: []
      }
      ranking: {
        Row: {
          id: string | null
          nome: string | null
          avatar_url: string | null
          escola_id: string | null
          turma_id: string | null
          escola_nome: string | null
          turma_nome: string | null
          xp: number | null
          level: number | null
          streak: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      agendar_consulta: {
        Args: {
          p_psicologo: string
          p_aluno: string
          p_inicio: string
          p_alerta?: string
        }
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"]
      }
      aplicar_operacao: {
        Args: {
          p_chave: string
          p_tipo: string
          p_dados: Json
          p_feita_em?: string
        }
        Returns: Json
      }
      atende_paciente: {
        Args: {
          p_aluno: string
        }
        Returns: boolean
      }
      atendo_o_aluno: {
        Args: {
          p_aluno: string
        }
        Returns: boolean
      }
      atribuir_professor_turma: {
        Args: {
          p_professor: string
          p_turma: string
        }
        Returns: undefined
      }
      avaliacoes_recebidas: {
        Args: Record<PropertyKey, never>
        Returns: {
          nota: number
          comentario: string
          criado_em: string
        }[]
      }
      avaliar_consulta: {
        Args: {
          p_agendamento: string
          p_nota: number
          p_comentario?: string
        }
        Returns: undefined
      }
      balde_da_flag: {
        Args: {
          p_user: string
          p_chave: string
        }
        Returns: number
      }
      bem_estar_paciente: {
        Args: {
          p_aluno: string
          p_dias?: number
        }
        Returns: {
          data: string
          score: number
          classe: string
        }[]
      }
      cancelar_consulta: {
        Args: {
          p_id: string
          p_motivo?: string
        }
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"]
      }
      chave_preferencia_notificacao: {
        Args: {
          p_tipo: string
        }
        Returns: string
      }
      comprar_item: {
        Args: {
          p_item_id: string
        }
        Returns: Database["public"]["Tables"]["gamificacao"]["Row"]
      }
      conceder_consentimento: {
        Args: {
          p_aluno: string
          p_psicologo: string
          p_escopo: string[]
          p_dias?: number
        }
        Returns: Database["public"]["Tables"]["consentimentos_dados"]["Row"]
      }
      concluir_tarefa: {
        Args: {
          p_data: string
          p_task_id: string
        }
        Returns: Database["public"]["Tables"]["gamificacao"]["Row"]
      }
      confirmar_pagamento_consulta: {
        Args: {
          p_agendamento: string
          p_ref: string
          p_meeting_url: string
          p_provider?: string
        }
        Returns: Database["public"]["Tables"]["agendamentos"]["Row"]
      }
      consentimento_vigente: {
        Args: {
          p_aluno: string
          p_psicologo: string
          p_escopo?: string
        }
        Returns: boolean
      }
      consultas_avaliadas: {
        Args: Record<PropertyKey, never>
        Returns: (string)[]
      }
      creditar_moedas_foco: {
        Args: {
          p_inicio: string
          p_fim: string
          p_interrupcoes?: number
          p_modo?: string
        }
        Returns: {
          saldo: number
          moedas_creditadas: number
          minutos: number
        }[]
      }
      crp_valido: {
        Args: {
          p_crp: string
        }
        Returns: boolean
      }
      dia_de_brasilia: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      docentes_da_escola: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
          email: string
          papel: string
        }[]
      }
      e_conta_demo: {
        Args: {
          p_user: string
        }
        Returns: boolean
      }
      e_menor_de_16: {
        Args: {
          p_aluno: string
        }
        Returns: boolean
      }
      enfileirar_notificacao: {
        Args: {
          p_user: string
          p_canal: Database["public"]["Enums"]["canal_notificacao"]
          p_tipo: string
          p_titulo: string
          p_corpo: string
          p_payload?: Json
        }
        Returns: string
      }
      entrar_na_turma: {
        Args: {
          p_codigo: string
        }
        Returns: Database["public"]["Tables"]["perfis"]["Row"]
      }
      entrar_sala_foco: {
        Args: {
          p_materia?: string
        }
        Returns: undefined
      }
      enviar_mensagem_apoio: {
        Args: {
          p_psicologo: string
          p_participante: string
          p_texto: string
        }
        Returns: Database["public"]["Tables"]["mensagens_apoio"]["Row"]
      }
      equipar_item: {
        Args: {
          p_item_id: string
        }
        Returns: undefined
      }
      escola_tem_assinatura_ativa: {
        Args: {
          p_escola_id: string
        }
        Returns: boolean
      }
      ficha_aluno: {
        Args: {
          p_aluno: string
        }
        Returns: {
          nome: string
          escola: string
          turma: string
          desde: string
        }[]
      }
      gastar_moedas_foco: {
        Args: {
          p_quantidade: number
          p_motivo: string
        }
        Returns: number
      }
      insights_turma_24h: {
        Args: {
          p_horas?: number
        }
        Returns: {
          materia: string
          topico: string
          alunos_com_dificuldade: number
          total_alunos: number
          taxa_dificuldade: number
          total_erros: number
          total_respostas: number
          perguntas_24h: number
        }[]
      }
      leciona_na_turma: {
        Args: {
          p_turma: string
        }
        Returns: boolean
      }
      lembretes_do_dia: {
        Args: {
          p_tipo: string
        }
        Returns: number
      }
      limpar_demonstracao: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      listar_sala_foco: {
        Args: Record<PropertyKey, never>
        Returns: {
          nome: string
          avatar_url: string
          materia: string
          minutos_foco: number
          entrou_em: string
          ultimo_ping: string
          eh_voce: boolean
        }[]
      }
      marcar_alerta: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["status_alerta"]
        }
        Returns: Database["public"]["Tables"]["alertas_saude_mental"]["Row"]
      }
      marcar_conversa_lida: {
        Args: {
          p_psicologo: string
          p_participante: string
        }
        Returns: undefined
      }
      materias_aluno: {
        Args: {
          p_aluno: string
          p_meses?: number
        }
        Returns: {
          materia: string
          questoes: number
          acertos: number
          taxa_acerto: number
        }[]
      }
      mesmo_mundo: {
        Args: {
          p_a: string
          p_b: string
        }
        Returns: boolean
      }
      meu_papel: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      meus_consentimentos: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          aluno_id: string
          aluno_nome: string
          psicologo_id: string
          psicologo_nome: string
          crp: string
          escopo: string[]
          valido_ate: string
          concedido_por: string
          vigente: boolean
        }[]
      }
      meus_responsaveis: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          responsavel: string
          email: string
          parentesco: string
          status: string
          desde: string
        }[]
      }
      minha_escola_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      minha_turma_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      minhas_conversas: {
        Args: Record<PropertyKey, never>
        Returns: {
          psicologo_id: string
          participante_id: string
          outro_nome: string
          ultima_texto: string
          ultima_em: string
          nao_lidas: number
          ativa: boolean
        }[]
      }
      minhas_flags: {
        Args: Record<PropertyKey, never>
        Returns: (string)[]
      }
      minhas_turmas: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
        }[]
      }
      nivel_por_xp: {
        Args: {
          p_xp: number
        }
        Returns: number
      }
      nota_propria_do_paciente: {
        Args: {
          p_nota: string
          p_aluno: string
        }
        Returns: boolean
      }
      notificar_responsaveis: {
        Args: {
          p_aluno: string
          p_tipo: string
          p_titulo: string
          p_corpo: string
          p_payload?: Json
        }
        Returns: number
      }
      pacientes: {
        Args: Record<PropertyKey, never>
        Returns: {
          aluno_id: string
          nome: string
          menor_de_16: boolean
          escopo: string[]
          valido_ate: string
          proxima: string
        }[]
      }
      pediu_vinculo_comigo: {
        Args: {
          p_pessoa: string
        }
        Returns: boolean
      }
      pingar_sala_foco: {
        Args: {
          p_minutos?: number
        }
        Returns: undefined
      }
      pode_conversar: {
        Args: {
          p_psicologo: string
          p_participante: string
        }
        Returns: boolean
      }
      pode_ver_resumo: {
        Args: {
          p_aluno: string
        }
        Returns: boolean
      }
      preparar_demonstracao: {
        Args: {
          p_aluno: string
          p_responsavel: string
          p_professor: string
          p_secretaria: string
          p_psicologo: string
        }
        Returns: string
      }
      professores_da_turma: {
        Args: {
          p_turma: string
        }
        Returns: {
          id: string
          nome: string
          email: string
        }[]
      }
      promover_usuario: {
        Args: {
          p_email: string
          p_papel: Database["public"]["Enums"]["papel_usuario"]
        }
        Returns: undefined
      }
      psicologo_visivel: {
        Args: {
          p_psicologo: string
        }
        Returns: boolean
      }
      pushes_para_enviar: {
        Args: {
          p_limite?: number
        }
        Returns: {
          id: string
          user_id: string
          tipo: string
          titulo: string
          corpo: string
          payload: Json
        }[]
      }
      quem_autoriza: {
        Args: {
          p_aluno: string
        }
        Returns: string
      }
      regenerar_codigo_instituicao: {
        Args: {
          p_escola_id: string
        }
        Returns: string
      }
      regenerar_codigo_turma: {
        Args: {
          p_turma_id: string
        }
        Returns: string
      }
      regenerar_codigo_vinculo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      registrar_burnout: {
        Args: {
          p_score: number
          p_classe: Database["public"]["Enums"]["classe_burnout"]
          p_features?: Json
        }
        Returns: {
          indice_id: number
          alerta_id: string
        }[]
      }
      registrar_desempenho_topico: {
        Args: {
          p_materia: string
          p_topico: string
          p_acertou: boolean
        }
        Returns: Database["public"]["Tables"]["quiz_desempenho_topicos"]["Row"]
      }
      registrar_intervencao: {
        Args: {
          p_tipo: string
          p_mensagem: string
          p_gatilho?: Json
        }
        Returns: number
      }
      registrar_psicologo: {
        Args: {
          p_email: string
          p_crp: string
          p_bio?: string
          p_espec?: string[]
          p_valor_reais?: number
        }
        Returns: string
      }
      registrar_revisao: {
        Args: {
          p_topico_id: string
          p_topico_nome: string
          p_materia: string
          p_nota: number
        }
        Returns: Database["public"]["Tables"]["revisoes_espacadas"]["Row"]
      }
      registrar_xp: {
        Args: {
          p_tipo: Database["public"]["Enums"]["log_tipo"]
          p_descricao: string
          p_xp?: number
        }
        Returns: Database["public"]["Tables"]["gamificacao"]["Row"]
      }
      reiniciar_indice: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      relatorio_turma: {
        Args: {
          p_turma: string
          p_dias?: number
        }
        Returns: {
          materia: string
          topico: string
          alunos_medidos: number
          alunos_com_dificuldade: number
          respostas: number
          taxa_acerto: number
        }[]
      }
      remover_professor_turma: {
        Args: {
          p_professor: string
          p_turma: string
        }
        Returns: undefined
      }
      responder_intervencao: {
        Args: {
          p_id: number
          p_aceita: boolean
        }
        Returns: undefined
      }
      responder_vinculo: {
        Args: {
          p_id: string
          p_aceitar: boolean
        }
        Returns: Database["public"]["Tables"]["vinculos_responsavel"]["Row"]
      }
      resumo_mensal_aluno: {
        Args: {
          p_aluno: string
          p_meses?: number
        }
        Returns: {
          mes: string
          minutos: number
          questoes: number
          acertos: number
          taxa_acerto: number
          dias_ativos: number
        }[]
      }
      resumo_semanal_aluno: {
        Args: {
          p_aluno: string
          p_semanas?: number
        }
        Returns: {
          semana: string
          minutos: number
          questoes: number
        }[]
      }
      resumo_turma: {
        Args: {
          p_turma: string
          p_dias?: number
        }
        Returns: {
          turma_nome: string
          total_alunos: number
          alunos_ativos: number
          respostas: number
          taxa_acerto: number
        }[]
      }
      revogar_consentimento: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      revogar_vinculo: {
        Args: {
          p_vinculo: string
        }
        Returns: undefined
      }
      sair_sala_foco: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      salvar_inscricao_push: {
        Args: {
          p_endpoint: string
          p_p256dh: string
          p_auth: string
          p_user_agent?: string
        }
        Returns: string
      }
      salvar_preferencias_notificacao: {
        Args: {
          p_tipos: Json
          p_silencio_inicio: number
          p_silencio_fim: number
          p_limite_diario: number
        }
        Returns: Database["public"]["Tables"]["preferencias_notificacao"]["Row"]
      }
      salvar_relatorio_semanal: {
        Args: {
          p_semana_inicio: string
          p_texto: string
          p_metricas?: Json
        }
        Returns: Database["public"]["Tables"]["relatorios_semanais"]["Row"]
      }
      slots_livres: {
        Args: {
          p_psicologo: string
          p_de?: string
          p_ate?: string
        }
        Returns: {
          inicio: string
          fim: string
        }[]
      }
      solicitar_vinculo: {
        Args: {
          p_email_aluno: string
          p_parentesco?: string
        }
        Returns: Database["public"]["Tables"]["vinculos_responsavel"]["Row"]
      }
      sou_criador_liga: {
        Args: {
          p_liga_id: string
        }
        Returns: boolean
      }
      sou_docente: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      sou_educador: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      sou_membro_liga: {
        Args: {
          p_liga_id: string
        }
        Returns: boolean
      }
      sou_psicologo: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      sou_responsavel_de: {
        Args: {
          p_aluno: string
        }
        Returns: boolean
      }
      termometro_cognitivo: {
        Args: {
          p_dias?: number
        }
        Returns: {
          turma_id: string
          turma_nome: string
          total_alunos: number
          com_indice: number
          exaustos: number
          em_alerta: number
          score_medio: number
          minutos_foco_medio: number
          distracoes_media: number
          fracao_madrugada: number
        }[]
      }
      vincular_instituicao: {
        Args: {
          p_codigo: string
        }
        Returns: Database["public"]["Tables"]["perfis"]["Row"]
      }
      vincular_por_codigo: {
        Args: {
          p_codigo: string
          p_parentesco?: string
        }
        Returns: Database["public"]["Tables"]["vinculos_responsavel"]["Row"]
      }
    }
    Enums: {
      canal_notificacao: "email" | "push" | "in_app"
      classe_burnout: "saudavel" | "alerta" | "fadiga" | "esgotamento"
      humor_tipo: "stress" | "anxiety" | "sadness" | "tired" | "demotivated" | "focused" | "motivated" | "happy" | "energetic" | "neutral"
      log_tipo: "atividade" | "exercicio" | "foco" | "quiz" | "essay" | "login" | "tutorial"
      papel_usuario: "student" | "educator" | "parent" | "admin" | "psychologist" | "teacher"
      severidade_alerta: "info" | "atencao" | "alto" | "critico"
      status_agendamento: "agendado" | "confirmado" | "concluido" | "cancelado" | "no_show"
      status_alerta: "aberto" | "visto" | "em_atendimento" | "resolvido"
      status_pagamento: "pendente" | "pago" | "reembolsado" | "falhou" | "isento"
      status_vinculo: "pendente" | "ativo" | "recusado" | "revogado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type Publico = Database["public"]

/** Linha de uma tabela ou view: `Tables<'perfis'>`. */
export type Tables<T extends keyof Publico["Tables"] | keyof Publico["Views"]> =
  T extends keyof Publico["Tables"]
    ? Publico["Tables"][T]["Row"]
    : T extends keyof Publico["Views"]
      ? Publico["Views"][T]["Row"]
      : never

/** O que um insert aceita: `TablesInsert<'perfis'>`. */
export type TablesInsert<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Insert"]

/** O que um update aceita: `TablesUpdate<'perfis'>`. */
export type TablesUpdate<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Update"]

/** Valores de um enum do banco: `Enums<'papel_usuario'>`. */
export type Enums<T extends keyof Publico["Enums"]> = Publico["Enums"][T]

/** Argumentos e retorno de uma função (RPC): `Rpc<'vincular_por_codigo'>`. */
export type Rpc<T extends keyof Publico["Functions"]> = Publico["Functions"][T]
