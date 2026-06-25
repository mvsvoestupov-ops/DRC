import React, { useMemo } from 'react';
import { Tree } from 'antd';

const buildTree = (standard) => {
  const root = {
    key: 'root',
    title: standard.name,
    children: []
  };

  const regNumber = standard.reg_number || standard.registration_number || '—';

  const meta = {
    key: 'meta',
    title: `Рег. № ${regNumber} | Приказ ${standard.order_number || ''} | Утв. ${standard.approval_date || ''}`,
    isLeaf: true
  };
  root.children.push(meta);

  const isEnriched = standard.type === 'enriched';

  if (standard.generalized_functions && standard.generalized_functions.length) {
    standard.generalized_functions.forEach(gf => {
      const gfNode = {
        key: gf.code || `gf-${Math.random()}`,
        title: `${gf.code || ''}: ${gf.name} (Уровень ${gf.level || ''})`.trim(),
        children: []
      };

      if (gf.possible_job_titles && gf.possible_job_titles.length) {
        gfNode.children.push({
          key: `${gf.code}-titles`,
          title: `Возможные должности: ${gf.possible_job_titles.join(', ')}`,
          isLeaf: true
        });
      }

      if (gf.particular_functions && gf.particular_functions.length) {
        gf.particular_functions.forEach(pf => {
          const pfNode = {
            key: pf.code || `pf-${Math.random()}`,
            title: `${pf.code || ''}: ${pf.name}`,
            children: []
          };

          if (isEnriched) {
            if (pf.labor_actions && pf.labor_actions.length) {
              pf.labor_actions.forEach(la => {
                const laNode = {
                  key: `la-${la.id || Math.random()}`,
                  title: la.text,
                  children: []
                };

                const skills = Array.isArray(la.skills) ? la.skills : [];
                if (skills.length) {
                  const skillsNode = {
                    key: `skills-${la.id || Math.random()}`,
                    title: `Умения (${skills.length})`,
                    children: skills.map((s, idx) => ({
                      key: `skill-${s.id || idx}`,
                      title: s.text || s,
                      isLeaf: true
                    }))
                  };
                  laNode.children.push(skillsNode);
                }

                const knowledges = Array.isArray(la.knowledges) ? la.knowledges : [];
                if (knowledges.length) {
                  const knowNode = {
                    key: `know-${la.id || Math.random()}`,
                    title: `Знания (${knowledges.length})`,
                    children: knowledges.map((k, idx) => ({
                      key: `know-${k.id || idx}`,
                      title: k.text || k,
                      isLeaf: true
                    }))
                  };
                  laNode.children.push(knowNode);
                }

                if (laNode.children.length === 0) {
                  laNode.isLeaf = true;
                }
                pfNode.children.push(laNode);
              });
            }
          } else {
            if (pf.labor_actions && pf.labor_actions.length) {
              const laNode = {
                key: `${pf.code}-la`,
                title: `Трудовые действия (${pf.labor_actions.length})`,
                children: pf.labor_actions.map((la, idx) => ({
                  key: `${pf.code}-la-${idx}`,
                  title: typeof la === 'object' ? la.text : la,
                  isLeaf: true
                }))
              };
              pfNode.children.push(laNode);
            }

            const skills = Array.isArray(pf.required_skills) ? pf.required_skills : [];
            if (skills.length) {
              const skillsNode = {
                key: `${pf.code}-skills`,
                title: `Умения (${skills.length})`,
                children: skills.map((s, idx) => ({
                  key: `${pf.code}-skills-${idx}`,
                  title: typeof s === 'object' ? s.text : s,
                  isLeaf: true
                }))
              };
              pfNode.children.push(skillsNode);
            }

            const knowledges = Array.isArray(pf.necessary_knowledges) ? pf.necessary_knowledges : [];
            if (knowledges.length) {
              const knowNode = {
                key: `${pf.code}-know`,
                title: `Знания (${knowledges.length})`,
                children: knowledges.map((k, idx) => ({
                  key: `${pf.code}-know-${idx}`,
                  title: typeof k === 'object' ? k.text : k,
                  isLeaf: true
                }))
              };
              pfNode.children.push(knowNode);
            }
          }

          if (pfNode.children.length === 0) {
            pfNode.isLeaf = true;
          }
          gfNode.children.push(pfNode);
        });
      }

      root.children.push(gfNode);
    });
  }

  return [root];
};

const StandardTree = ({ data }) => {
  const treeData = useMemo(() => buildTree(data), [data]);

  if (!data) {
    return <div>Нет данных для отображения</div>;
  }

  return (
    <Tree
      treeData={treeData}
      defaultExpandAll
      showLine
      showIcon
    />
  );
};

export default StandardTree;